// Import necessary libraries
const { google } = require('googleapis');
const express = require('express');

// --- CONFIGURATION ---
// These values MUST be stored as Environment Variables on your hosting platform (Vercel).
// DO NOT paste them directly into the code.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI; // The URL of this function itself.
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN; // You will get this in a later step.
const YOUR_ACCOUNT_ID = process.env.YOUR_GOOGLE_ACCOUNT_ID; // Find this in your Google Business Profile URL.
const YOUR_LOCATION_ID = process.env.YOUR_GOOGLE_LOCATION_ID; // Find this in your Google Business Profile URL.

// Initialize Express app
const app = express();

// Create a new OAuth2 client with the credentials
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// --- ROUTES ---

// Endpoint 1: The main endpoint to fetch reviews
// Your Shopify site will call this URL: https://<your-vercel-url>/api/reviews
app.get('/api/reviews', async (req, res) => {
  // Allow requests from your Shopify store for local development and production
  res.setHeader('Access-Control-Allow-Origin', '*'); // For production, lock this down to your Shopify URL

  if (!REFRESH_TOKEN) {
    return res.status(500).json({ error: 'Refresh Token not configured on the server.' });
  }

  try {
    // Set the refresh token on the OAuth2 client
    oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN,
    });

    // The client will automatically use the refresh token to get a new access token.
    const mybusiness = google.mybusinessbusinessinformation({
      version: 'v1',
      auth: oauth2Client,
    });

    // Fetch the reviews
    const response = await mybusiness.accounts.locations.reviews.list({
      // The parent resource name to get reviews for. e.g. "accounts/12345/locations/67890"
      parent: `accounts/${YOUR_ACCOUNT_ID}/locations/${YOUR_LOCATION_ID}`,
      pageSize: 50, // Get up to 50 reviews
      orderBy: 'updateTime desc', // Get the newest first
    });

    // Send the reviews back to the Shopify site
    res.status(200).json(response.data);

  } catch (error) {
    console.error('Error fetching reviews:', error.message);
    res.status(500).json({ error: 'Failed to fetch Google Reviews.' });
  }
});


// Endpoint 2: A one-time-use endpoint to start the authorization process
// You will manually visit this URL in your browser ONCE.
app.get('/api/authorize', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/business.manage'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Important to get a refresh token
    scope: scopes,
  });
  // Redirect your browser to the Google consent screen
  res.redirect(url);
});


// Endpoint 3: The callback endpoint that Google redirects back to
// You will be redirected here after you approve the consent screen.
app.get('/api/callback', async (req, res) => {
  const { code } = req.query;
  try {
    // Exchange the authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
        throw new Error("Refresh token was not provided by Google. Did you already authorize this app? Try removing access in your Google account settings and re-authorizing.");
    }
    
    // IMPORTANT: Display the refresh token.
    // Copy this value and save it as the GOOGLE_REFRESH_TOKEN environment variable in Vercel.
    res.send(`
      <h1>Authorization Successful!</h1>
      <p>Your Refresh Token is:</p>
      <pre style="font-size: 1.2em; background-color: #eee; padding: 20px; border-radius: 5px; word-wrap: break-word;">${refreshToken}</pre>
      <p><b>ACTION REQUIRED:</b> Copy this token and add it to your Environment Variables in Vercel as <code>GOOGLE_REFRESH_TOKEN</code>. You can now close this window.</p>
    `);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    res.status(500).send('Failed to get refresh token. ' + error.message);
  }
});


// Export the app for Vercel
module.exports = app;
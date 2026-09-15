# Together account setup

The React account page is at `/#account`. Supabase Auth stores accounts and manages sessions. The booth remains available without an account during this initial integration. Points, orders, receipt storage, and admin approval are not yet implemented.

## Dashboard configuration

1. Keep email/password authentication and email confirmation enabled.
2. In Authentication → URL Configuration, set Site URL to your stable website origin. For local testing you can use `http://127.0.0.1:5173/`.
3. Add the exact redirect URLs for each origin you test:
   - `http://127.0.0.1:5173/#account`
   - `http://127.0.0.1:5173/?recovery=1#account`
   - Your current HTTPS tunnel origin with `/#account` and `/?recovery=1#account`.
   Update these when a temporary tunnel changes. Do not allow all third-party tunnel domains.
4. Configure custom SMTP for email confirmation and password reset before testing with customers. Supabase's default email sender restricts recipients to project team addresses.
5. For Google, create a Web OAuth client in Google Auth Platform. Use the callback URL shown by Supabase's Google provider settings as the authorized redirect URI. Configure the consent screen and authorized origins, then save the client ID and secret in Supabase and enable Google. Never put the Google client secret in a VITE variable. The Google button checks the provider's enabled state when the account page opens.

## Test with an account you own

- Sign up, open the confirmation email in the same browser, and sign in.
- Refresh and reopen the website: My account should show the same email.
- Sign out and verify the page returns to the sign-in form.
- Request a password reset, open it in the same browser, save a new password, then sign out and sign in with that password.
- Enable Google, reload the account page, and test Google sign-in and cancellation.
- Test an expired link, invalid credentials, and loss of network connectivity.
- Test navigation away from a booth with photos: the existing leave warning should still appear before entering the account page.

The integration uses PKCE. Links require the verifier stored in the browser that requested them; opening a link on a different device is not supported by this flow. No real signup emails were sent during implementation testing.

Sources: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/auth-smtp

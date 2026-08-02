async function installGoogleAuth(page) {
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
        window.__googleAuthMock = {
          mode: "success",
          delay: 0,
          requestCount: 0,
        };
        window.google = {
          accounts: {
            oauth2: {
              initTokenClient(config) {
                return {
                  requestAccessToken() {
                    const mock = window.__googleAuthMock;
                    mock.requestCount += 1;
                    setTimeout(() => {
                      if (mock.mode === "popup_error") {
                        config.error_callback({ type: "popup_closed" });
                      } else if (mock.mode === "oauth_error") {
                        config.callback({ error: "access_denied" });
                      } else {
                        config.callback({ access_token: "test-access-token" });
                      }
                    }, mock.delay);
                  },
                };
              },
            },
          },
        };
      `,
    })
  );

  return {
    setMode: (mode) =>
      page.evaluate((value) => {
        window.__googleAuthMock.mode = value;
      }, mode),
    setDelay: (delay) =>
      page.evaluate((value) => {
        window.__googleAuthMock.delay = value;
      }, delay),
    requestCount: () =>
      page.evaluate(() => window.__googleAuthMock.requestCount),
  };
}

module.exports = { installGoogleAuth };

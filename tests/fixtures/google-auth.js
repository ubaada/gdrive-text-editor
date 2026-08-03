async function installGoogleAuth(page) {
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
        window.__googleAuthMock = {
          mode: sessionStorage.getItem("drive-edit-auth-mode") || "success",
          delay: 0,
          requestCount: 0,
          lastOptions: null,
        };
        window.google = {
          accounts: {
            oauth2: {
              initTokenClient(config) {
                return {
                  requestAccessToken(options = {}) {
                    const mock = window.__googleAuthMock;
                    mock.requestCount += 1;
                    mock.lastOptions = options;
                    setTimeout(() => {
                      if (mock.mode === "popup_error") {
                        config.error_callback({ type: "popup_closed" });
                      } else if (
                        mock.mode === "silent_error" &&
                        options.prompt === "none"
                      ) {
                        config.callback({ error: "interaction_required" });
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
        sessionStorage.setItem("drive-edit-auth-mode", value);
      }, mode),
    setDelay: (delay) =>
      page.evaluate((value) => {
        window.__googleAuthMock.delay = value;
      }, delay),
    requestCount: () =>
      page.evaluate(() => window.__googleAuthMock.requestCount),
    lastPrompt: () =>
      page.evaluate(() => window.__googleAuthMock.lastOptions?.prompt),
    lastLoginHint: () =>
      page.evaluate(() => window.__googleAuthMock.lastOptions?.login_hint),
  };
}

module.exports = { installGoogleAuth };

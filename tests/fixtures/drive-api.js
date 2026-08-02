const DRIVE_URL = /^https:\/\/www\.googleapis\.com\/(upload\/)?drive\/v3\/files/;
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function publicFile(file) {
  const { content, ...metadata } = file;
  return metadata;
}

function parseMultipart(request) {
  const contentType = request.headers()["content-type"];
  const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
  const raw = request.postDataBuffer().toString("utf8");
  const parts = raw.split(`--${boundary}`);
  const metadata = JSON.parse(parts[1].split("\r\n\r\n")[1].trim());
  const content = parts[2]
    .split("\r\n\r\n")
    .slice(1)
    .join("\r\n\r\n")
    .replace(/\r\n$/, "");
  return { metadata, content };
}

async function installDriveApi(page) {
  const files = new Map();
  const folderDelays = new Map();
  const fileDelays = new Map();
  let nextId = 1;

  function addFolder({ id = `folder-${nextId++}`, name, parentId = "root" }) {
    const folder = {
      id,
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: [parentId],
      version: "1",
      modifiedTime: new Date().toISOString(),
    };
    files.set(id, folder);
    return folder;
  }

  function addFile({
    id = `file-${nextId++}`,
    name,
    content = "",
    parentId = "root",
    mimeType = "text/plain",
  }) {
    const file = {
      id,
      name,
      content,
      mimeType,
      parents: [parentId],
      version: "1",
      modifiedTime: new Date().toISOString(),
    };
    files.set(id, file);
    return file;
  }

  await page.route(DRIVE_URL, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isUpload = url.pathname.startsWith("/upload/");
    const id = url.pathname.split("/files/")[1];

    if (request.method() === "GET" && !id) {
      const parentId = url.searchParams.get("q")?.match(/'([^']+)' in parents/)?.[1];
      await delay(folderDelays.get(parentId) || 0);
      const children = [...files.values()]
        .filter((file) => file.parents?.includes(parentId))
        .map(publicFile);
      return route.fulfill({ json: { files: children } });
    }

    if (request.method() === "GET" && id && url.searchParams.get("alt") === "media") {
      await delay(fileDelays.get(id) || 0);
      const file = files.get(id);
      return file
        ? route.fulfill({ body: file.content, contentType: file.mimeType })
        : route.fulfill({ status: 404, json: { error: { message: "Not found" } } });
    }

    if (request.method() === "GET" && id) {
      const file = files.get(id);
      return file
        ? route.fulfill({ json: publicFile(file) })
        : route.fulfill({ status: 404, json: { error: { message: "Not found" } } });
    }

    if (request.method() === "POST" && isUpload) {
      const { metadata, content } = parseMultipart(request);
      const file = addFile({
        name: metadata.name,
        content,
        parentId: metadata.parents[0],
        mimeType: metadata.mimeType,
      });
      return route.fulfill({ json: publicFile(file) });
    }

    if (request.method() === "POST") {
      const metadata = request.postDataJSON();
      const item = metadata.mimeType === FOLDER_MIME_TYPE
        ? addFolder({ name: metadata.name, parentId: metadata.parents[0] })
        : addFile({
            name: metadata.name,
            parentId: metadata.parents[0],
            mimeType: metadata.mimeType,
          });
      return route.fulfill({ json: publicFile(item) });
    }

    if (request.method() === "PATCH" && isUpload) {
      const file = files.get(id);
      file.content = request.postData();
      file.version = String(Number(file.version) + 1);
      file.modifiedTime = new Date().toISOString();
      return route.fulfill({ json: publicFile(file) });
    }

    return route.fulfill({ status: 405, body: "Unhandled Drive mock request" });
  });

  return {
    addFile,
    addFolder,
    get: (id) => files.get(id),
    findByName: (name) => [...files.values()].find((file) => file.name === name),
    setFolderDelay: (id, milliseconds) => folderDelays.set(id, milliseconds),
    setFileDelay: (id, milliseconds) => fileDelays.set(id, milliseconds),
  };
}

module.exports = { FOLDER_MIME_TYPE, installDriveApi };

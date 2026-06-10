import { google } from "googleapis";
import { Readable } from "stream";

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!email || !key || !folderId) {
    throw new Error("Google Drive env vars not configured");
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return { drive: google.drive({ version: "v3", auth }), folderId };
}

export async function uploadToDrive(
  filename: string,
  content: string,
  mimeType: string
): Promise<{ id: string; name: string }> {
  const { drive, folderId } = getDriveClient();

  const stream = Readable.from([content]);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id,name",
  });

  return { id: res.data.id!, name: res.data.name! };
}

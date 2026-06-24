'use strict';

/*
 * Storage seam. The rest of the server talks to this interface so the file-backed
 * implementation can be swapped for a database / object store without touching
 * auth or sync logic. Select an implementation via STORE (only "file" today).
 *
 * Interface:
 *   getUsers(): Record<email, user>
 *   saveUsers(users): void
 *   getBlob(email): { updatedAt, blob } | null
 *   setBlob(email, { updatedAt, blob }): void
 *   deleteUser(email): void          // removes the user and their blob
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createFileStore(usersFile, blobDir) {
  function blobPath(email) {
    const h = crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
    return path.join(blobDir, `${h}.json`);
  }
  return {
    getUsers() {
      try { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch { return {}; }
    },
    saveUsers(users) {
      try {
        fs.mkdirSync(path.dirname(usersFile), { recursive: true });
        fs.writeFileSync(usersFile, JSON.stringify(users));
      } catch { /* ignore */ }
    },
    getBlob(email) {
      try { return JSON.parse(fs.readFileSync(blobPath(email), 'utf8')); } catch { return null; }
    },
    setBlob(email, data) {
      fs.mkdirSync(blobDir, { recursive: true });
      fs.writeFileSync(blobPath(email), JSON.stringify(data));
    },
    deleteUser(email) {
      const users = this.getUsers();
      delete users[email];
      this.saveUsers(users);
      try { fs.unlinkSync(blobPath(email)); } catch { /* no blob */ }
    },
  };
}

function build() {
  const kind = process.env.STORE || 'file';
  if (kind === 'file') {
    const usersFile = process.env.USERS_FILE || path.join(__dirname, '.users.json');
    const blobDir = process.env.BLOB_DIR || path.join(__dirname, '.blobs');
    return createFileStore(usersFile, blobDir);
  }
  throw new Error(`Unknown STORE: ${kind}`);
}

module.exports = build();
module.exports.createFileStore = createFileStore;

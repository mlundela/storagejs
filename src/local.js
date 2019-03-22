import Promise from 'bluebird';
import fs from 'fs';
import path from 'path';
import {Observable} from 'rxjs';

Promise.promisifyAll(fs);

async function exists(path) {
  return await fs.accessAsync(path, fs.constants.R_OK)
    .then(() => true)
    .catch(() => false);
}

async function createFolder(directory) {
  if (!await exists(directory)) {
    await createFolder(path.dirname(directory));
    await fs.mkdirAsync(directory)
      .catch(err => {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      });
  }
}

export class LocalStorage {
  constructor(root) {
    this.root = root;
  }

  /**
   * @param {string} filename
   * @param {string|null} encoding
   * @returns {Promise}
   */
  get(filename, encoding = null) {
    return fs.readFileAsync(this._getFullPath(filename), {encoding});
  }

  /**
   * @param {string} filename
   * @returns {ReadStream}
   */
  getStream(filename){
    return fs.createReadStream(this._getFullPath(filename));
  }

  /**
   * @param {string} filename
   * @param {string|buffer|Readable|Observable} content
   * @param options Not used here, but in S3 store
   * @returns {Promise}
   */
  async put(filename, content, options = {}) {
    const destination = this._getFullPath(filename);

    await createFolder(path.dirname(destination));

    if (content instanceof Observable) {
      const outputStream = fs.createWriteStream(destination);
      return content.do(
        chunk => outputStream.write(chunk),
        null,
        () => outputStream.end()
      ).toPromise(Promise);
    }

    if (content.readable && content.pipe) {
      return new Promise((resolve, reject) => {
        content.pipe(fs.createWriteStream(destination))
          .on('close', () => resolve())
          .on('error', err => reject(err));
      });
    }

    return await fs.writeFileAsync(destination, content);
  }

  /**
   * @param {string} filename
   * @returns {Promise}
   */
  remove(filename) {
    return fs.unlinkAsync(this._getFullPath(filename))
      .catch(err => {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      });
  }

  /**
   * @param {string} filename
   * @returns {Promise.<boolean>}
   */
  exists(filename) {
    return exists(this._getFullPath(filename));
  }

  /**
   * @param {string} filename
   * @returns {url|string}
   */
  getLocation(filename) {
    return `file://${this._getFullPath(filename)}`;
  }

  _getFullPath(filename) {
    return path.resolve(this.root, filename);
  }
}

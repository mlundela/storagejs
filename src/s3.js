import AWS from 'aws-sdk'
import Promise from 'bluebird'
import mime from 'mime-types'
import { Observable } from 'rxjs'
import { PassThrough } from 'stream'

AWS.config.setPromisesDependency(Promise)

export class S3Storage {
  constructor (bucket, options) {
    this.bucket = bucket
    this.s3 = new AWS.S3(options)
    this.region = options && options.region
  }

  exists (filename) {
    return this.s3.headObject({
      Bucket: this.bucket,
      Key: filename,
    }).promise()
      .catch(err => {
        if (err.name !== 'NotFound') {
          throw err
        }
      })
  }

  put (filename, content, options = {}) {
    if (content instanceof Observable) {
      return new Promise((resolve, reject) => {
        const stream = new PassThrough()
        content.subscribe(
          chunk => stream.write(chunk),
          err => reject(err),
          () => stream.end()
        )

        this.s3.upload({
          Bucket: this.bucket,
          Key: filename,
          Body: stream,
          ...options,
          ...{ContentType: options.ContentType || mime.lookup(filename) || 'application/octet-stream'}
        }, (err, data) => err ? reject(err) : resolve(data))
      })
    }

    return this.s3.upload({
      Bucket: this.bucket,
      Key: filename,
      Body: content,
      ...options,
      ...{ContentType: options.ContentType || mime.lookup(filename) || 'application/octet-stream'}
    }).promise()
  }

  get (filename) {
    return this.s3.getObject({
      Bucket: this.bucket,
      Key: filename,
    })
      .promise()
      .then(response => response.Body)
  }

  /**
   * @param {string} filename
   * @returns {ReadStream}
   */
  getStream (filename) {
    return this.s3.getObject({
      Bucket: this.bucket,
      Key: filename,
    }).createReadStream()
  }

  remove (key) {
    return this.s3.deleteObject({Bucket: this.bucket, Key: key}).promise()
  }

  getLocation (key) {
    if (this.region === 'us-east-1') {
      return `https://${this.bucket}.s3.amazonaws.com/${key}`
    } else {
      return `https://${this.bucket}.s3-${this.region}.amazonaws.com/${key}`
    }
  }
}

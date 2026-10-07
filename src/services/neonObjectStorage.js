const { AwsClient } = require('aws4fetch');

const getAddress = () => {
    const { AWS_ENDPOINT_URL_S3 } = process.env;
    const bucket = process.env.NEON_STORAGE_BUCKET;
    if (!AWS_ENDPOINT_URL_S3 || !bucket) {
        const error = new Error('Neon Object Storage is not configured. Set AWS_ENDPOINT_URL_S3 and NEON_STORAGE_BUCKET.');
        error.status = 503;
        throw error;
    }
    return { endpoint: AWS_ENDPOINT_URL_S3.replace(/\/+$/, ''), bucket };
};

const getClient = () => {
    const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
        const error = new Error('Neon Object Storage upload credentials are missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
        error.status = 503;
        throw error;
    }
    const region = process.env.AWS_REGION || 'us-east-2';
    return { client: new AwsClient({ accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY, service: 's3', region }) };
};

const getObjectUrl = (key) => {
    const { endpoint, bucket } = getAddress();
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${endpoint}/${encodeURIComponent(bucket)}/${encodedKey}`;
};

async function putImage(key, file) {
    const { client } = getClient();
    const response = await client.fetch(getObjectUrl(key), {
        method: 'PUT',
        headers: {
            'content-type': file.mimetype,
            'cache-control': 'public, max-age=31536000, immutable',
        },
        body: file.buffer,
    });
    if (!response.ok) throw new Error(`Neon Object Storage upload failed (${response.status}).`);
    return getObjectUrl(key);
}

async function deleteObject(key) {
    if (!key) return;
    const { client } = getClient();
    const response = await client.fetch(getObjectUrl(key), { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
        throw new Error(`Neon Object Storage delete failed (${response.status}).`);
    }
}

module.exports = { getObjectUrl, putImage, deleteObject };

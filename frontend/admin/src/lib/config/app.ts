import packageMetadata from '../../../package.json';

export const APP_NAME = 'RayFlow';

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? packageMetadata.version;

export const CHATGPT_GENERATION_FAILURE_MESSAGE = 'ChatGPT 返回图片失败，请重新生成';

export const DEFAULT_MAX_GENERATED_IMAGE_BYTES = 2_000_000;

const getBase64Payload = (dataUrl) => {
  if (typeof dataUrl !== 'string') return '';
  const commaIndex = dataUrl.indexOf(',');
  return (commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl).replace(/\s/g, '');
};

export const getDataUrlByteSize = (dataUrl) => {
  const base64 = getBase64Payload(dataUrl);
  if (!base64) return 0;

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

export const shouldRejectGeneratedImage = ({
  width,
  height,
  byteSize,
  maxBytes = DEFAULT_MAX_GENERATED_IMAGE_BYTES
}) => {
  const isSuspiciousSquareFallback = width === 1024 && height === 1024;
  const isTooLarge = byteSize > maxBytes;
  return isSuspiciousSquareFallback || isTooLarge;
};

export const validateGeneratedImageMetadata = (metadata) => {
  if (shouldRejectGeneratedImage(metadata)) {
    throw new Error(CHATGPT_GENERATION_FAILURE_MESSAGE);
  }

  return metadata;
};

const readImageDimensions = (dataUrl) => new Promise((resolve, reject) => {
  if (typeof Image === 'undefined') {
    reject(new Error(CHATGPT_GENERATION_FAILURE_MESSAGE));
    return;
  }

  const image = new Image();
  image.onload = () => {
    resolve({
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height
    });
  };
  image.onerror = () => reject(new Error(CHATGPT_GENERATION_FAILURE_MESSAGE));
  image.src = dataUrl;
});

export const validateGeneratedImageDataUrl = async (dataUrl) => {
  const byteSize = getDataUrlByteSize(dataUrl);
  const { width, height } = await readImageDimensions(dataUrl);
  return validateGeneratedImageMetadata({ width, height, byteSize });
};

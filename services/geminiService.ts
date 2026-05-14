type ServerConfig = {
  serverConfigured: boolean;
  provider?: string;
  imageModel?: string;
  namingModel?: string;
  authRequired?: boolean;
};

let serverConfigPromise: Promise<ServerConfig> | null = null;

export const resetServerConfigCache = () => {
  serverConfigPromise = null;
};

const getServerConfig = async (): Promise<ServerConfig> => {
  if (!serverConfigPromise) {
    serverConfigPromise = fetch('/api/config', {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    })
      .then(async (response) => {
        if (response.status === 401) {
          throw new Error('请先登录后再生成表情包');
        }
        if (!response.ok) {
          return { serverConfigured: false };
        }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          return { serverConfigured: false };
        }
        const data = await response.json();
        return {
          serverConfigured: Boolean(data.serverConfigured),
          provider: data.provider,
          imageModel: data.imageModel,
          namingModel: data.namingModel,
          authRequired: Boolean(data.authRequired)
        };
      })
      .catch((error) => {
        serverConfigPromise = null;
        if (error instanceof Error && error.message.includes('请先登录')) {
          throw error;
        }
        return { serverConfigured: false };
      });
  }

  return serverConfigPromise;
};

const getApiConfig = () => {
  const apiKey = localStorage.getItem('emojicut_api_key') || process.env.API_KEY;
  // Remove trailing slashes from URL
  const baseUrl = (localStorage.getItem('emojicut_api_url') || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const modelName = localStorage.getItem('emojicut_model_name') || 'gemini-3-pro-image-preview';
  const namingModel = localStorage.getItem('emojicut_naming_model') || 'gemini-2.5-flash';

  return { apiKey, baseUrl, modelName, namingModel };
};

// ==================== Sticker Style Presets ====================

export interface StickerStyle {
  id: string;
  name: string;        // 中文显示名
  description: string; // 风格描述
}

export const STICKER_STYLES: StickerStyle[] = [
  {
    id: 'line_cute',
    name: '可爱LINE贴纸',
    description: '可爱的卡通二头身角色，适合日常聊天'
  },
  {
    id: 'chibi_expressive',
    name: 'Q版表情包',
    description: '夸张表情的Q版角色，情绪丰富'
  },
  {
    id: 'kawaii_pastel',
    name: '粉彩少女风',
    description: '柔和粉彩配色，梦幻少女感'
  },
  {
    id: 'dynamic_action',
    name: '动感活力风',
    description: '活泼动作姿势，充满活力'
  }
];

/**
 * Build the generation prompt with base template + user-defined style
 */
export const buildStickerPrompt = (style: StickerStyle, customStyle?: string): string => {
  // Use generic term or style name if available, but "sticker set" is safer base.
  // The User complaint was that it ALWAYS said "LINE sticker".
  // Let's make it generic: "16 distinct stickers".
  const basePrompt = `为图中角色设计一个可爱的卡通角色，生成 16个不同动作的贴纸。姿势和文字排版要富有创意，变化丰富，设计独特。对话应为简体中文，可以是角色在不同场景，不同情绪的，角色比例二头身。

重要要求：背景必须是纯白色(#FFFFFF)，不要有任何其他颜色或图案。每个贴纸之间要有足够间距，避免相邻贴纸互相粘连。每个表情内部的对话文字、装饰图案、动作符号必须和对应角色主体足够贴近，距离控制在 10px 以内，防止切图时文字或图案被识别成独立贴纸。`;

  let styleDescription = `画面风格：${style.description}`;

  if (customStyle && customStyle.trim()) {
    styleDescription += `。画面风格和要求为：${customStyle.trim()}`;
  }

  // Move style to top for visibility and emphasis
  return `${styleDescription}\n\n${basePrompt}`;
};

/**
 * Helper to make the API request using fetch
 */
const callGeminiApi = async (
  model: string,
  contents: any[],
  apiKey: string,
  baseUrl: string,
  responseSchema?: any
): Promise<any> => {
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body: any = { contents };
  if (responseSchema) {
    body.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const safeErrorText = errorText.length > 1200 ? `${errorText.slice(0, 1200)}…` : errorText;

    // Check for common proxy/redirect errors
    if (safeErrorText.includes("EOF while parsing") || safeErrorText.includes("body size is 0")) {
      throw new Error(
        `代理服务错误: 请求内容丢失(Body Lost)。\n\n` +
        `这通常是因为使用了 HTTP 代理地址但发生了 HTTPS 重定向。\n` +
        `请检查设置中的 "API 地址"：\n` +
        `1. 确保以 http:// 或 https:// 开头\n` +
        `2. 尝试将 http:// 改为 https:// (或反之)\n` +
        `3. 确保代理服务器支持 POST 请求转发`
      );
    }

    throw new Error(`API Error ${response.status}: ${safeErrorText}`);
  }

  const data = await response.json();
  return data;
};

const callServerApi = async <T,>(endpoint: string, payload: unknown): Promise<T> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) {
    throw new Error(data.error || `Server API Error ${response.status}`);
  }
  return data as T;
};

/**
 * Generate a sticker sheet using Gemini
 */
export const generateStickerSheet = async (
  referenceImage: string,
  style: StickerStyle,
  customStyle?: string
): Promise<string> => {
  const prompt = buildStickerPrompt(style, customStyle);
  const serverConfig = await getServerConfig();
  if (serverConfig.serverConfigured) {
    const data = await callServerApi<{ imageDataUrl: string }>('/api/generate-sticker', {
      referenceImage,
      prompt
    });
    return data.imageDataUrl;
  }

  const { apiKey, baseUrl, modelName } = getApiConfig();
  if (!apiKey) throw new Error("API_KEY is not set");

  try {
    const cleanBase64 = referenceImage.includes(',')
      ? referenceImage.split(',')[1]
      : referenceImage;

    const contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: prompt }
        ]
      }
    ];

    const data = await callGeminiApi(modelName, contents, apiKey, baseUrl);

    // Extract image
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image returned from generation. Check console for response.");

  } catch (error) {
    console.error("Sticker Generation Error:", error);
    throw error;
  }
};

/**
 * Generate sticker name
 */
export const generateStickerName = async (base64Image: string): Promise<string> => {
  const serverConfig = await getServerConfig();
  if (serverConfig.serverConfigured) {
    try {
      const data = await callServerApi<{ filename: string }>('/api/generate-name', {
        imageDataUrl: base64Image
      });
      return data.filename || "sticker";
    } catch (error) {
      return "sticker";
    }
  }

  const { apiKey, baseUrl, namingModel } = getApiConfig();
  if (!apiKey) return "sticker";

  try {
    const cleanBase64 = base64Image.split(',')[1];

    // Naming usually requires a faster/cheaper model
    // Uses the configured model from settings (defaults to gemini-2.5-flash)

    const contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
          { text: "Analyze this sticker. Return a JSON object with a 'filename' property (max 4 Chinese characters, describing user mood or action). Example: '开心', '点赞', '暗中观察'." }
        ]
      }
    ];

    const schema = {
      type: "OBJECT",
      properties: {
        filename: { type: "STRING" }
      }
    };

    const data = await callGeminiApi(namingModel, contents, apiKey, baseUrl, schema);

    if (data.candidates && data.candidates[0]?.content?.parts) {
      const textPart = data.candidates[0].content.parts.find((p: any) => p.text);
      if (textPart) {
        const json = JSON.parse(textPart.text);
        return json.filename || "sticker";
      }
    }
    return "sticker";

  } catch (error) {
    return "sticker";
  }
};

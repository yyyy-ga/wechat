import { Client } from '@notionhq/client';
import axios from 'axios';
import FormData from 'form-data';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async (req, res) => {
  const { content, picUrl, mediaId, msgType } = req.body;
  let text = content;

  // 图片类：先下载到内存，再 OCR
  if (msgType === 'image') {
    const img = await axios.get(picUrl, { responseType: 'arraybuffer' });
    text = await deepSeekOCR(img.data);
  }

  // PDF/文件：通过 mediaId 下载临时文件（需公众号 access_token，略）
  const { title, tags, category, summary } = await deepSeekAnalyze(text);

  await notion.pages.create({
    parent: { database_id: process.env.NOTION_DB },
    properties: {
      Title: { title: [{ text: { content: title } }] },
      Tags: { multi_select: tags.map(t => ({ name: t })) },
      Category: { select: { name: category } },
      Summary: { rich_text: [{ text: { content: summary } }] },
      'Raw Content': { rich_text: [{ text: { content } }] }
    }
  });
  res.send('ok');
};

async function deepSeekOCR(buffer) {
  const form = new FormData();
  form.append('file', buffer, { filename: 'img.jpg' });
  const { data } = await axios.post('https://api.deepseek.com/v1/ocr', form, {
    headers: { Authorization: `Bearer ${process.env.DEEPSEEK_KEY}`, ...form.getHeaders() }
  });
  return data.text;
}

async function deepSeekAnalyze(text) {
  const prompt = `
请根据以下文本：
1. 取一个 20 字以内的标题
2. 给出 3-5 个中文标签
3. 判断分类：文章 / 图片 / 链接 / PDF / 其他
4. 用 50 字以内总结内容
仅返回 JSON：
{"title":"","tags":[],"category":"","summary":""}
文本：${text}
`;

  const { data } = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    },
    { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_KEY}` } }
  );
  return JSON.parse(data.choices[0].message.content);
}

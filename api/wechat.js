import crypto from 'crypto';
import xml2js from 'xml2js';
export default async (req, res) => {
  if (req.method === 'GET') {         // 微信服务器验证
    const { signature, timestamp, nonce, echostr } = req.query;
    const token = process.env.WX_TOKEN;
    const tmp = [token, timestamp, nonce].sort().join('');
    const sign = crypto.createHash('sha1').update(tmp).digest('hex');
    return sign === signature ? res.send(echostr) : res.status(403).send('Forbidden');
  }

  // POST 消息
  const xml = await xml2js.parseStringPromise(req.body);
  const msg = xml.xml;
  const fromUser = msg.FromUserName[0];
  const content = msg.Content?.[0] || '';
  const picUrl  = msg.PicUrl?.[0] || '';
  const mediaId = msg.MediaId?.[0] || '';
  const msgType = msg.MsgType[0];

  // 非阻塞丢给异步队列
  fetch(`${process.env.VERCEL_URL}/api/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromUser, content, picUrl, mediaId, msgType })
  });

  // 微信要求 5 秒内回包，先回 success
  res.send('success');
};

const {Configuration, OpenAIApi } = require("openai")

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  console.log(req.body)
  console.log(req.headers.token)
  try{
  const completion = await openai.createChatCompletion(
    {
    "model": "gpt-3.5-turbo",
    "temperature": 0.2,
    "messages":[
        {"role": "system","content": "you are english teacher for Japanese Junior Highschool student. You must not talk without English learning.You are cute word chice in Japanese"},
        {"role": "assistant","content": "please fix following sentence of dialy. Then tell me why you fixed it in Japanse."},
        {"role": "assistant","content":
        `
        following is expample of output
        your diary : {input diary} 
        fixed diary : {fixed diary} 
        文章ごとに何をどう修正したかを以下の形式で日本語で説明します
        ============
        1. {reason1}
        2. {reason2}
        ...
        n. {reasonn} 
        ============
        例えば"I go to shopping"という文章は"I go shopping"の方が自然な表現なので修正しました。のように具体的に説明します
        please output as above format.良いですか?
        `},
        {"role": "user","content": req.body.diary}
    ]
    })
  console.log(completion.data.choices[0])
  res.status(200).json({ text: completion.data.choices[0].message.content});
    }catch(e){
        console.log(e.response.statusText)
        res.status(500).json({ text: "error" });
    }
}
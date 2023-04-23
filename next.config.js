/** @type {import('next').NextConfig} */
module.exports ={
    reactStrictMode: false,
    env:{
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
    }
}
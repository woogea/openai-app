import Head from 'next/head'
import Layout from '../components/layout'
import utilStyles from '../styles/utils.module.css'
import {useState, useEffect} from 'react'
import SignInForm  from '../components/signinform'
import { useAuthState } from '../hooks/useAuthState'
export default function Home({ allPostsData }) {
  const { isSignedIn, userName } = useAuthState()
  return (
    <Layout home>
      <Head>
        <title> openai app</title>
      </Head>
      <div>
        <SignInForm/>
      </div>
      <div>{(()=>{if(isSignedIn){return body()}else{return <></>}})()}</div>
    </Layout>
  )
}

const body = ()=>{return(
        <><section>
    <h1>英語の日記添削君</h1>
  </section><section>
      <h2>英語で日記を書いてみよう</h2>
      <textarea id="diaryInput" name="diary" rows={20} cols={150}></textarea>
      <button onClick={async () => {
        const diary = (document.getElementById('diaryInput') as HTMLInputElement).value
        const resp = await fetch('/api/diary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ diary }),
        })
        const data = await resp.json()
        console.log(data);
        (document.getElementById('diaryOutput') as HTMLInputElement).value = data.text
      } }>添削する</button>
    </section><section>
      <textarea id="diaryOutput" name="diary" rows={80} cols={150}></textarea>
    </section></>
)}

import Head from 'next/head';
import Layout from '../components/layout';
import SignInForm from '../components/signinform';
import DiaryEditor from '../components/diaryeditor';
import { useAuthState } from '../hooks/useAuthState';

export default function Home() {
  const { isSignedIn, userId } = useAuthState();
  return (
    <Layout home>
      <Head><title>openai app</title></Head>
      <SignInForm />
      {isSignedIn && <DiaryEditor key={userId} />}
    </Layout>
  );
}

import { FC } from 'react'
import Router from 'next/router'
export const SignInOrOutButton: FC = () => {
    return <button onClick={()=>Router.push('/signin')}>SignOut</button>
}
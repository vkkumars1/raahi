import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/offer', '/find', '/chat']

export function middleware(request: NextRequest) {
  const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`))
  if (isProtected && !request.cookies.has('raahi_session')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*', '/offer/:path*', '/find/:path*', '/chat/:path*'] }

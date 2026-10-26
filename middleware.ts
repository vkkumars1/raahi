import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/offer', '/chat', '/rides', '/find/book']

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProtected = protectedRoutes.some((route) => path === route || path.startsWith(`${route}/`))
  if (isProtected && !request.cookies.has('raahi_session')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/offer/:path*', '/chat/:path*', '/rides/:path*', '/find/book/:path*'],
}

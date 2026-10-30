import {memberTermsReviewHtml} from '@/lib/mobile/terms-document';
export function GET() {
 if(process.env.SMART_TRUST_MOBILE_ENABLED !== 'true')return new Response('Not enabled',{status:404});
 return new Response(memberTermsReviewHtml(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"}});
}


import { GET as sharedGET } from "@/app/mobile/route";
export const dynamic = "force-dynamic";
export async function GET() {
  const response = sharedGET();
  if (response.status !== 200) return response;
  const html = (await response.text()).replace('href="/"', 'href="https://troothhurtz.app/"').replace('<main ', '<aside role="note" style="padding:12px;color:#f1d27a;background:#080603">Protected test build. Sign in separately here with an approved website account. Website workspace links open troothhurtz.app; their session is separate.</aside><main ');
  return new Response(html, { status: response.status, headers: response.headers });
}

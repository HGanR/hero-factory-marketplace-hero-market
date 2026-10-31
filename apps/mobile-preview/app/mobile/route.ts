import { GET as sharedGET } from "@/app/mobile/route";
export const dynamic = "force-dynamic";
export function GET() {
  return sharedGET();
}

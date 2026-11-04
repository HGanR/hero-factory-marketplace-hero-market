declare module 'qrcode' {
  type Ecc='L'|'M'|'Q'|'H';
  type Matrix={size:number;data:Uint8Array;get:(row:number,column:number)=>number};
  const QRCode:{create:(text:string,options?:{errorCorrectionLevel?:Ecc})=>{modules:Matrix;version:number}};
  export default QRCode;
}

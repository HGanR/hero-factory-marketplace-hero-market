export async function prepareStadiumImage(file:File){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a PNG, JPEG or WebP under 5 MB');
 const bitmap=await createImageBitmap(file);
 try{const canvas=document.createElement('canvas'),ratio=Math.min(1,1536/bitmap.width,768/bitmap.height);canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing unavailable');ctx.fillStyle='#07192c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);for(const quality of [.85,.65,.45,.25]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=130000)return data;}throw Error('Choose a smaller or simpler image');}finally{bitmap.close()}
}

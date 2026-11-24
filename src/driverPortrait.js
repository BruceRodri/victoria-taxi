export async function driverPortrait(file,en) {
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024)
    throw Error(en?"Choose a JPG, PNG or WebP up to 10 MB.":"Elige una foto JPG, PNG o WebP de hasta 10 MB.");
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    image.src=url;
    await image.decode();
    const size=Math.min(image.width,image.height);
    const canvas=document.createElement("canvas");
    canvas.width=canvas.height=240;
    canvas.getContext("2d").drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,240,240);
    return canvas.toDataURL("image/jpeg",0.85);
  } finally {URL.revokeObjectURL(url);}
}

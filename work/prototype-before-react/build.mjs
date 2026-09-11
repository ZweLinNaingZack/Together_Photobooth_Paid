import {mkdir,copyFile,readdir,readFile} from 'node:fs/promises';
await mkdir('dist/public',{recursive:true});
for(const file of ['index.html','style.css','app.js','booth-core.js','booth-flow.js','booth-flow.css']){await copyFile(file,`dist/${file}`)}
for(const file of await readdir('public'))await copyFile(`public/${file}`,`dist/public/${file}`);
for(const file of ['woman.jpg','man.jpg']){const data=await readFile(`dist/public/${file}`);if(data.length<1000)throw Error(`Missing image: ${file}`)}
console.log('Built Together design preview into dist.');

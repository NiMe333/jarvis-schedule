import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const source=path.resolve(process.argv[2]||'data/user-settings.sqlite');
const destinationDir=path.resolve(process.argv[3]||'backups');
mkdirSync(destinationDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const destination=path.join(destinationDir,`user-settings-${stamp}.sqlite`);
const db=new DatabaseSync(source);
db.exec(`VACUUM INTO '${destination.replaceAll("'","''")}'`);
db.close();
console.log(destination);

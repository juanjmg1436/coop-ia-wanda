import {randomBytes,createHash} from 'node:crypto';
const code=randomBytes(32).toString('hex');
console.log('Guardá este código de acceso en tu gestor de contraseñas. No lo pegues en un chat.');
console.log('Código de administrador (se ingresa solo en el formulario COOP.IA):\n'+code);
console.log('\nValor para el secreto ADMIN_TOKEN_HASH:\n'+createHash('sha256').update(code).digest('hex'));
console.log('\nEl hash no permite recuperar el código. Para revocar accesos existentes, vaciá sessions en D1 y generá un código nuevo.');

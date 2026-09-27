import { buildLogoEscposBuffer } from './lib/print/logo';

async function testLogo() {
  const url = 'https://picsum.photos/200/200'; // Sample image
  const buffer = await buildLogoEscposBuffer(url, '80mm');
  if (buffer) {
    console.log('✅ Logo successfully processed into ESC/POS buffer!');
    console.log('Buffer length:', buffer.length);
    console.log('First 20 bytes:', buffer.subarray(0, 20));
  } else {
    console.log('❌ Failed to process logo into buffer.');
  }
}

testLogo().catch(console.error);

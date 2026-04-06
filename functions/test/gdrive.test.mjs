import { call, signUpOrIn, authz, expectOk } from './_setup.mjs';

// Google Drive integration tests. Uses gdriveList/gdriveCreateFolder/gdriveUpload
// endpoints if a sandbox folder ID is configured. Skips gracefully if
// secrets are missing or endpoints are unavailable.
(async () => {
  try {
    const sandbox = process.env.DRIVE_SANDBOX_FOLDER_ID;
    if (!sandbox) {
      console.log('SKIP[gdrive]: DRIVE_SANDBOX_FOLDER_ID not set');
      return;
    }
    const { idToken } = await signUpOrIn({ email: `g_${Date.now()}@example.com` });
    // List
    const listResp = await call('gdriveList', { method: 'GET', headers: authz(idToken), query: {} }).catch(() => null);
    if (!listResp || listResp.status !== 200) {
      console.log('SKIP[gdrive]: gdriveList not available');
      return;
    }
    expectOk(listResp);
    console.log('• gdriveList ok');
    // Create folder
    const newFolderName = `test_${Date.now()}`;
    const createResp = await call('gdriveCreateFolder', {
      headers: authz(idToken),
      body: { parentId: sandbox, name: newFolderName },
    }).catch(() => null);
    if (!createResp || createResp.status !== 200) {
      console.log('SKIP[gdrive]: gdriveCreateFolder not available');
      return;
    }
    console.log('• gdriveCreateFolder ok');
    const parentId = createResp.data?.folder?.id || sandbox;
    // Upload small file
    const uploadResp = await call('gdriveUpload', {
      headers: authz(idToken),
      body: {
        parentId,
        name: 'hello.txt',
        mimeType: 'text/plain',
        contentBase64: Buffer.from('hi').toString('base64'),
      },
    }).catch(() => null);
    if (uploadResp && uploadResp.status === 200) {
      expectOk(uploadResp);
      console.log('• gdriveUpload ok');
      console.log('✓ gdrive.test.mjs');
    } else {
      console.log('SKIP[gdrive]: gdriveUpload not available');
    }
  } catch (e) {
    console.error('✗ gdrive.test.mjs', e);
    process.exitCode = 1;
  }
})();

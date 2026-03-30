import 'dotenv/config';

import { createApp } from './app/createApp';

const app = createApp();
const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
	console.log(`Server listening on http://localhost:${port}`);
});

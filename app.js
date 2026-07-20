const express = require('express');
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const app = express();

app.use(express.json());

// 静的ファイルを公開（CSSや画像などもこれで読み込める）
app.use(express.static('.'));

// 強制的に index.html を表示する設定
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 環境変数から設定を読み込む
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_FILE = 'posts.json';
const PORT = process.env.PORT || 3000;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// 投稿データ取得API
app.get('/api/posts', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error reading data');
    }
});

// 投稿データ保存API
app.post('/api/save', async (req, res) => {
    try {
        // 1. ローカルファイルを更新
        fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));

        // 2. GitHubから現在のファイルのSHAを取得
        let fileSha = null;
        try {
            const { data: fileData } = await octokit.rest.repos.getContent({
                owner: OWNER,
                repo: REPO,
                path: 'posts.json'
            });
            fileSha = fileData.sha;
        } catch (error) {
            if (error.status !== 404) throw error;
        }

        // 3. GitHubへ作成または更新
        const params = {
            owner: OWNER,
            repo: REPO,
            path: 'posts.json',
            message: '投稿データを更新',
            content: Buffer.from(JSON.stringify(req.body, null, 2)).toString('base64'),
        };

        if (fileSha) params.sha = fileSha;

        await octokit.rest.repos.createOrUpdateFileContents(params);

        res.status(200).send('OK');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error saving data');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
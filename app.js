const express = require('express');
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const app = express();

const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_FILE = 'posts.json';
const octokit = new Octokit({ auth: GITHUB_TOKEN });

app.use(express.json());
app.use(express.static('public'));

// 起動時にGitHubからデータをダウンロードして同期する関数
async function syncFromGitHub() {
    try {
        console.log("GitHubからデータを同期中...");
        const { data } = await octokit.rest.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: DATA_FILE
        });
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        fs.writeFileSync(DATA_FILE, content);
        console.log("同期完了！");
    } catch (err) {
        console.log("GitHubにまだデータがないか、同期失敗：", err.message);
    }
}

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

        // 2. GitHubからSHAを取得
        let fileSha = null;
        try {
            const { data: fileData } = await octokit.rest.repos.getContent({
                owner: OWNER,
                repo: REPO,
                path: DATA_FILE
            });
            fileSha = fileData.sha;
        } catch (error) {
            if (error.status !== 404) throw error;
        }

        // 3. GitHubへプッシュ
        const params = {
            owner: OWNER,
            repo: REPO,
            path: DATA_FILE,
            message: 'データ更新',
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

// 起動時に同期を実行してからサーバーを立ち上げる
const PORT = process.env.PORT || 3000;
syncFromGitHub().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
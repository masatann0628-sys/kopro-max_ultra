const express = require('express');
const fs = require('fs');
const { Octokit } = require('@octokit/rest');
const app = express();

app.use(express.json());
app.use(express.static('.')); // ← これが「index.htmlを表示する」ための魔法のコードだよ

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

        // 2. GitHubから現在のファイルのSHAを取得（ファイルがない場合は無視）
        let fileSha = null;
        try {
            const { data: fileData } = await octokit.rest.repos.getContent({
                owner: OWNER,
                repo: REPO,
                path: 'posts.json'
            });
            fileSha = fileData.sha;
        } catch (error) {
            // 404エラー（ファイルがない）の場合はエラーとせず続行
            if (error.status === 404) {
                console.log("ファイルが未作成のため新規作成します");
            } else {
                throw error; // 404以外はエラーとして処理
            }
        }

        // 3. GitHubへ作成または更新
        const params = {
            owner: OWNER,
            repo: REPO,
            path: 'posts.json',
            message: '投稿データを更新',
            content: Buffer.from(JSON.stringify(req.body, null, 2)).toString('base64'),
        };

        // SHAがあれば更新、なければ新規作成になる
        if (fileSha) {
            params.sha = fileSha;
        }

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
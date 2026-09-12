# Deploying the backend from GitHub Actions to EC2

A push to `main` that touches `backend/` now runs the test suite and, only if it
passes, puts that exact commit on the EC2 box and restarts it under PM2. The
workflow is `.github/workflows/deploy-backend.yml`.

Until the five secrets below exist, the deploy job stops on its first step with
a message naming the missing one — it never half-deploys.

## The secrets to add

GitHub → the repository → **Settings** → **Secrets and variables** → **Actions**
→ *New repository secret*. Add these five (and `HEALTH_URL` only if the API is
not at the default below). **Add them yourself** — a private key must not be
pasted into a chat, an issue or a commit.

| Secret | What it is | Example |
| --- | --- | --- |
| `EC2_HOST` | Public DNS or IP of the instance | `ec2-13-234-56-78.ap-south-1.compute.amazonaws.com` |
| `EC2_USER` | The SSH user | `ubuntu` |
| `EC2_SSH_KEY` | The **whole** private key that opens that instance, `-----BEGIN …` line included | contents of your `.pem` |
| `EC2_APP_DIR` | The repository's directory on the box (the folder holding `backend/`) | `/home/ubuntu/mrpscan-app` |
| `EC2_PM2_NAME` | The PM2 process name | `mrpscan-backend` |
| `EC2_KNOWN_HOSTS` | Recommended. The instance's SSH host key, so a deploy refuses any other machine at that address. Get it with `ssh-keyscan -H <EC2_HOST>` and paste the whole output | `\|1\|…= ssh-ed25519 AAAA…` |
| `HEALTH_URL` | Optional. Defaults to `https://appapi.mrpscan.com/api/v1/health` | |

Without `EC2_KNOWN_HOSTS` the deploy trusts whichever machine answers at
`EC2_HOST` that run — it says so in the log. EC2 hands public addresses to new
instances when old ones are stopped, so add the key once and a stale
`EC2_HOST` fails the step instead of deploying to a stranger.

Find the PM2 name on the server with `pm2 list`, and the directory with
`pm2 info <name>` (its `cwd`).

## What the pipeline does

1. **Test** — `npm ci` and `npm test` in `backend/`. The suite runs entirely on
   fakes: no database, no Redis, no paid API call. A red suite stops the deploy.
2. **Deploy** — SSH in, `git fetch`, then **`merge --ff-only` to the pushed
   commit**. Fast-forward only on purpose: if someone edited files or committed
   directly on the server, the deploy fails and says so instead of discarding
   their work. `npm ci --omit=dev` installs from the lockfile, so the box runs
   the versions the tests ran against and carries no dev packages.
   `pm2 restart --update-env` picks up any `.env` change; `.env` is gitignored
   and is never touched by a deploy.
3. **Verify** — polls `/api/v1/health` until it answers with the `commit` field
   matching the deployed SHA. That endpoint reports the commit it is running, so
   a green tick means *this* code is serving, not merely that something is up.

The workflow's own token is read-only and is not left in the checkout, so a
package install script cannot use it to push; the deploy job has no token at
all. The SSH key is removed from the runner when the job ends, whatever the
outcome, and the deploy only runs for `imshus/mrpscan` itself — never a fork.

## Checking a run

The **Actions** tab, newest run at the top. Green tick on the commit = tested,
deployed, and confirmed serving. A failure tells you which of the three stages
stopped it:

- **Test** — the code is not on the server; fix and push again.
- **Deploy** — most often `merge --ff-only` refusing because the server's
  checkout has drifted. SSH in, `git status`, commit or discard that work, and
  re-run the job from the Actions tab.
- **Check the API came back** — the files are there but the process is not
  serving them. `pm2 logs <name> --lines 100` on the box.

Use **Run workflow** on that tab for a redeploy without a code change — after
editing `.env` on the server, for example.

## One-time setup on the instance

The workflow assumes the box already has the repository cloned, Node and PM2
installed, `.env` filled in, and the process started once by hand
(`pm2 start src/server.js --name mrpscan-backend`, then `pm2 save`). It also
assumes the server can `git fetch` from GitHub — for a private repository that
means a deploy key or a credential helper on the instance.

Nothing about the Android app changes: APKs are still built locally with
`npm run build:apk`.

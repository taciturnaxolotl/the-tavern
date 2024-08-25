# The Tavern

Welcome to The Tavern, your friendly quest bot! I run in the bag channels in Hackclub's [#market](https://app.slack.com/client/T0266FRGM/C06GA0PSXC5) channel! Just ping [@The Tavern](https://app.slack.com/client/T0266FRGM/D07HGJZG6HJ) and you will be on your way to fame and glory!

![the startup sequence](https://github.com/kcoderhtml/the-tavern/raw/master/.github/images/cli.png)

## Creating New Quests

You can easily create new quests by editing the YAML file `/lib/quests.yaml`. Here’s a simple example of how a quest might look:

```yaml
quests:
  baby-bear:
    description: 'A baby bear has lost its mother in the forest. Help the baby bear find its mother and return to The Tavern for a reward.'
    items: 'Stew, Bread'
    scenes:
      scene1:
        prompt: 'Agree to help the baby bear find its mom.'
        character: 'cubby'
      scene2:
        prompt: 'Explore the forest with the bear and find a squirrel for help.'
        character: 'cubby'
```

characters can be created in the same file by making a new entry like this:

```yaml
characters:
    cubby:
        prompt: "You are a curious and innocent baby bear. You trust the party quickly and follow them closely, but you often get distracted by smells or sounds. You mostly communicate through gestures, growls, and occasional babyish words like 'Mama.' Your goal is to find your mother."
        image: 'https://cloud-e3njarhaf-hack-club-bot.vercel.app/3baby.jpg'
```

Just customize the prompts and characters, and The Tavern bot will auto source everything and work!

## Development

### Getting it up and running

The quick answer is to pull the repo make a slackbot with the [`manifest.yaml`](https://github.com/kcoderhtml/the-tavern/blob/master/manifest.yaml) thats in the root of this repo and then `bun i; bunx prisma generate; bunx prisma db push` to get the db and everything installed and ready to go! The last bit is pretty simple just `bun ngrok` and `bun dev`! A sample env file is below; for more details see [`DOCS.md`](https://github.com/kcoderhtml/the-tavern/blob/master/DOCS.md)

```bash
SLACK_BOT_TOKEN=xoxb-xxxxxxx-xxxxxxx-xxxxxxxxxxxxx
SLACK_SIGNING_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_LOG_CHANNEL=Cxxxxxxx
NODE_ENV=development
ADMINS=Uxxxxxxxx
BOT_ID=Bxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx-x-xxxxxxxxxxxxxxxxxxxxxxxxx
BAG_APP_ID=00
BAG_APP_KEY=xxxxxxxx-xxxxx-xxxxx-xxxxx-xxxxxxxxxxxxx
```

### Editing Quests

If you need to change the quest structure or add new characters, simply edit the relevant YAML files and restart The Tavern bot.

```bash
git pull
systemctl --user restart tavern
```

This way, your new quests will be ready for action!

## Production

Deploying The Tavern in a production environment is pretty easy. Simply use a systemctl service file to manage the bot (i totaly would have used docker but i was burned by docker-prisma interactions in the past and so now I'm sticking to systemd services lol):

```ini
[Unit]
Description=The Tavern Bot
DefaultDependencies=no
After=network-online.target

[Service]
Type=exec
WorkingDirectory=/home/kierank/tavern
ExecStart=python run.py
TimeoutStartSec=0
Restart=on-failure
RestartSec=1s

[Install]
WantedBy=default.target
```

I used [nest](https://guides.hackclub.app/index.php/Quickstart) to run my bot but it should run on any systemd based system with `bun` and `node` installed!

## Meet the Characters

<p><img align="left" width="100" height="100" src="https://cloud-e3njarhaf-hack-club-bot.vercel.app/3baby.jpg">

**Cubby:** A curious and innocent baby bear who quickly trusts the party. Often distracted by smells or sounds, Cubby communicates through gestures, growls, and babyish words like "Mama." The goal is to find Cubby's mother.</p>

<br/>

<p><img align="right" width="100" height="100" src="https://cloud-e3njarhaf-hack-club-bot.vercel.app/2mama.jpg">

**Matilda**: A fierce and protective mother bear. Initially aggressive but calms down when she realizes the party is helping her cub. Speaks in a deep, gruff voice with simple, direct language. Her goal is to protect her cub.</p>

<p><img align="left" width="100" height="100" src="https://cloud-e3njarhaf-hack-club-bot.vercel.app/0squirrel.jpg">

**Nibbles**: An energetic and talkative squirrel who loves gossip. Will share information if given food or a shiny object. Speaks quickly and is easily distracted, with the goal of acquiring food or shiny things.</p>
<br/>

<p><img align="right" width="100" height="100" src="https://cloud-91y9kizkb-hack-club-bot.vercel.app/0image.png">

**Grumbles**: A reclusive and grumpy old hermit who lives deep in the forest. Wise and knowledgeable about the forest's history, Grumbles speaks in riddles and cryptic phrases. Prefers to be left alone but may help the party if they show respect for the forest.</p>

<p><img align="left" width="100" height="100" src="https://cloud-e3njarhaf-hack-club-bot.vercel.app/1keeper.png">

**McDuffy**: The gruff and rude proprietor of the tavern, McDuffy is Scottish and eventually warms up to the party. He lives in the tavern and is often found standing behind the bar.</p>
<br/>

<p><img align="right" width="100" height="100" src="https://cloud-8sz1eisgu-hack-club-bot.vercel.app/0image.png">

**Whispering Voice**: A disembodied whisper that seems to come from all directions within the grove. It speaks in riddles and lures those who listen deeper into the forest. The voice has a haunting, echoing quality, with an undertone of menace and curiosity.</p>


---

_© 2024 Kieran Klukas_  
_Licensed under [AGPL 3.0](LICENSE.md)_

---
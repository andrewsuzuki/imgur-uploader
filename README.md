# imgur-uploader

Simple CLI tool for uploading local images to Imgur.
- Add images to a new or existing album (optional)
- Link images and albums to account (recommended) or anonymous
- Dependency-free

Imgur is still one of the most reliable free image hosts in 2024. It's my go-to when sharing photosets on forums.
However, the new web interface is bad. There's no upload progress indicator. When uploading many (30+) images at a time, it seems to send all the requests in parallel, which bugs out and results in front-end and API errors. This tool sends them sequentially.

## Usage

Requires [Node](https://nodejs.org) 18+ or [Deno](https://deno.com).

```sh
# With NPX
# Upload image (anonymous)
npx github:andrewsuzuki/imgur-uploader --client-id CLIENT_ID foo.jpg
# Upload image (account)
npx github:andrewsuzuki/imgur-uploader --access-token ACCESS_TOKEN foo.jpg
# Upload multiple images, then add them to a new album (account)
npx github:andrewsuzuki/imgur-uploader --access-token ACCESS_TOKEN --create-album path/to/images/*.jpg
# Upload multiple images, then add them to a new album, with a title (account)
npx github:andrewsuzuki/imgur-uploader --access-token ACCESS_TOKEN --create-album --album-title "My Photo Album" path/to/images/*.jpg
# Upload multiple images, then add them to an existing album (account only)
npx github:andrewsuzuki/imgur-uploader --access-token ACCESS_TOKEN --update-album ALBUM_ID path/to/images/*.jpg

# With global npm install
npm install -g github:andrewsuzuki/imgur-uploader
imgur-uploader ...

# With Deno
deno run --allow-read --allow-net https://raw.githubusercontent.com/andrewsuzuki/imgur-uploader/refs/heads/main/imgur-uploader.js ...
```

### Authorization

To use, you must register an application [here](https://imgur.com/account/settings/apps) (choose "OAuth 2 authorization without a callback URL").

It will then give you a client ID (view your registered apps [here](https://imgur.com/account/settings/apps)). You can use this to upload images anonymously with `--client-id` (not recommended; higher risk of future deletion).

If you want to attach the images and albums to your account (recommended), you must go through the OAuth 2 authorization flow available from Imgur [here](https://api.imgur.com/oauth2/authorize?response_type=token&client_id=CLIENT_ID) (replace CLIENT_ID with your client ID).

After authorizing, it will redirect you to a URL like this: https://imgur.com/#access_token=ACCESS_TOKEN&expires_in=...

Extract the ACCESS_TOKEN from the URL, then you can use the tool with `--access-token`.

## Alternatives

- [tremby/imgur.sh](https://github.com/tremby/imgur.sh) bash, only anonymous uploads, no album support
- [FigBug/imguru](https://github.com/FigBug/imguru) C++ binary, only anonymous uploads, no album support

## Misc

If you want to delete an image uploaded anonymously or with an account, you can navigate to https://imgur.com/delete/DELETEHASH (replace DELETEHASH with the image's deletehash).

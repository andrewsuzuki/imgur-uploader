#!/usr/bin/env node

// @andrewsuzuki/imgur-uploader
// Simple CLI tool to upload local images to Imgur. Supports albums and linking to an account.
// Copyright (c) 2024 Andrew Suzuki (https://andrewsuzuki.com)

import { stat, readFile } from "node:fs/promises";
import process from "node:process";

export class ImgurUploader {
  #baseUrl = "https://api.imgur.com/3";
  #clientId;
  #accessToken;

  constructor({ clientId, accessToken } = {}) {
    if ((clientId && accessToken) || (!clientId && !accessToken)) {
      throw new Error(
        "Must provide either clientId OR accessToken, but not both"
      );
    }
    this.#clientId = clientId || undefined;
    this.#accessToken = accessToken || undefined;
  }

  async #apiRequest(method, endpoint, { body, headers = {} } = {}) {
    headers.Accept = "application/json";
    headers.Authorization = this.#accessToken
      ? `Bearer ${this.#accessToken}`
      : `Client-ID ${this.#clientId}`;

    try {
      const response = await fetch(`${this.#baseUrl}${endpoint}`, {
        method,
        headers,
        body,
      });

      let responseData;
      try {
        // Don't bother checking the Content-Type header because Imgur
        // uses some weird custom application/json variants sometimes.
        // Try parsing as json, fine if it isn't.
        responseData = await response.json();
      } catch (_e) {}

      if (responseData) {
        if (responseData.success && response.ok) {
          return responseData.data;
        } else {
          const firstErrorString =
            responseData.errors?.[0]?.detail || "Unknown error";
          throw new Error(`[${response.status}] ${firstErrorString}`);
        }
      } else {
        // Imgur gives us their user-facing 404 html...
        if (response.status === 404) {
          throw new Error("[404] Not Found");
        } else {
          throw new Error(
            `[${response.status}] Unknown error (non-json response)`
          );
        }
      }
    } catch (error) {
      throw new Error(`API Request failed: ${error.message}`);
    }
  }

  async #apiRequestJson(method, endpoint, jsonBody) {
    const body = JSON.stringify(jsonBody);
    const headers = {
      "Content-Type": "application/json",
    };
    return this.#apiRequest(method, endpoint, { body, headers });
  }

  async uploadImage(imagePath) {
    try {
      const imageData = await readFile(imagePath);
      return this.#apiRequestJson("POST", "/image", {
        image: imageData.toString("base64"),
        type: "base64",
      });
    } catch (error) {
      throw new Error(`Error uploading image ${imagePath}: ${error.message}`);
    }
  }

  async createAlbum(deletehashes, title) {
    const albumPartial = await this.#apiRequestJson(
      "POST",
      "/album",
      title ? { title } : {}
    );
    if (!albumPartial.deletehash) {
      throw new Error("Couldn't find deletehash in new album");
    }
    // API bug: if anonymous, a POST to album with deletehashes doesn't add the given images.
    // So, add them with a separate call.
    await this.addImagesToAlbum(albumPartial.deletehash, deletehashes);
    return albumPartial; // { id, deletehash }
  }

  async addImagesToAlbum(albumIdOrDeletehash, deletehashes) {
    return this.#apiRequestJson("PUT", `/album/${albumIdOrDeletehash}/add`, {
      deletehashes,
    });
  }

  async getAlbum(albumHash) {
    return this.#apiRequest("GET", `/album/${albumHash}`);
  }

  async getAccount() {
    if (!this.#accessToken) {
      throw new Error("No access token provided. Cannot fetch account info.");
    }
    return this.#apiRequest("GET", "/account/me");
  }
}

async function validateRequestedImages(imagePaths) {
  const invalidImages = [];

  for (const imagePath of imagePaths) {
    try {
      const stats = await stat(imagePath);
      if (!stats.isFile()) {
        invalidImages.push(`${imagePath} (not a file)`);
      }
    } catch (error) {
      invalidImages.push(`${imagePath} (${error.message})`);
    }
  }

  if (invalidImages.length > 0) {
    throw new Error(
      "The following images are invalid or inaccessible:\n" +
        invalidImages.map((img) => `- ${img}`).join("\n")
    );
  }
}

function parseArgs(args, options = { flags: [] }) {
  const named = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);

      // Handle --key=value format
      if (arg.includes("=")) {
        const equalIndex = arg.indexOf("=");
        const k = arg.slice(2, equalIndex);
        const v = arg.slice(equalIndex + 1);

        if (options.flags.includes(k)) {
          throw new Error(`Flag "${k}" doesn't accept a value`);
        }
        named[k] = v;
      }
      // Handle flags (booleans)
      else if (options.flags.includes(key)) {
        named[key] = true;
      }
      // Handle --key value format
      else {
        if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
          named[key] = args[i + 1];
          i++; // Skip next argument since we used it as a value
        } else {
          throw new Error(`Missing value for argument: ${arg}`);
        }
      }
    } else {
      positional.push(arg);
    }
  }

  return { ...named, _: positional };
}

async function main(args) {
  try {
    if (args.length === 0) {
      console.error(
        [
          "@andrewsuzuki/imgur-uploader",
          "Copyright (c) 2024 Andrew Suzuki",
          "Arguments:",
          "--client-id=CLIENT_ID (anonymous upload)",
          "--access-token=ACCESS_TOKEN (account upload)",
          "--create-album (add uploaded images to new album)",
          "--album-title=ALBUM_TITLE (optional album title for --create-album)",
          "--update-album=ALBUM_ID (add uploaded images to existing album owned by account)",
          "[IMAGE...]",
        ].join("\n")
      );
      process.exit(1);
    }

    const { _: imagePaths, ...namedArgs } = parseArgs(args, {
      flags: ["create-album"],
    });
    if (imagePaths.length === 0) {
      throw new Error("At least one image is required");
    }
    const allowedKeys = new Set([
      "client-id",
      "access-token",
      "create-album",
      "album-title",
      "update-album",
    ]);
    for (const key of Object.keys(namedArgs)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Unknown argument --${key}`);
      }
    }
    const clientId = namedArgs["client-id"];
    const accessToken = namedArgs["access-token"];
    const createAlbum = namedArgs["create-album"];
    const albumTitle = namedArgs["album-title"];
    const updateAlbum = namedArgs["update-album"];
    if ((!clientId && !accessToken) || (clientId && accessToken)) {
      throw new Error(
        "Exactly one of --client-id and --access-token is required"
      );
    }
    if (createAlbum && updateAlbum) {
      throw new Error("Cannot use --update-album with --create-album");
    }
    if (updateAlbum && !accessToken) {
      throw new Error("Cannot use --update-album without --access-token");
    }
    if (albumTitle && !createAlbum) {
      throw new Error("--album-title is only allowed with --create-album");
    }

    await validateRequestedImages(imagePaths);

    const uploader = new ImgurUploader({ clientId, accessToken });

    let account;
    if (accessToken) {
      account = await uploader.getAccount();
      console.log(`Uploading as ${account.url}`);
    } else {
      console.log("Uploading anonymously");
    }

    // If updating an album, make sure it exists and belongs to our account first
    if (updateAlbum) {
      let album;
      try {
        album = await uploader.getAlbum(updateAlbum);
      } catch (e) {
        throw new Error(`Couldn't retrieve album: ${e}`);
      }
      if (album.account_id !== account?.id) {
        throw new Error("Album must belong to account");
      }
    }

    const uploadedImages = [];
    for (const [index, imagePath] of imagePaths.entries()) {
      console.log(
        `\nUploading ${imagePath} (${index + 1}/${imagePaths.length})...`
      );

      const imageData = await uploader.uploadImage(imagePath);
      uploadedImages.push(imageData);

      console.log(
        `Successfully uploaded image ${index + 1}/${imagePaths.length}`
      );
      console.log(`Image ID: ${imageData.id}`);
      console.log(`Image deletehash: ${imageData.deletehash}`);
      console.log(`Link: ${imageData.link}`);
    }

    // Create or update album
    if (uploadedImages.length > 0) {
      const deletehashes = uploadedImages.map((img) => img.deletehash);

      if (createAlbum) {
        console.log("\nCreating new album...");
        const albumData = await uploader.createAlbum(deletehashes, albumTitle);
        console.log("Successfully created album");
        console.log(`Album ID: ${albumData.id}`);
        console.log(`Album deletehash: ${albumData.deletehash}`);
        console.log(`Link: https://imgur.com/a/${albumData.id}`);
      } else if (updateAlbum) {
        console.log("\nAdding images to existing album...");
        await uploader.addImagesToAlbum(updateAlbum, deletehashes);
        console.log("Successfully added images to album");
        console.log(`Link: https://imgur.com/a/${updateAlbum}`);
      }
    }

    console.log("\nDone");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main(process.argv.slice(2));

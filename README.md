# Uber Back Office

CLI and web server in one place.

Easy to register common models from common persistency libraries:

   ubo-config.js
    const UboMongoose = require("ubo-mongoose");
    module.exports = async (ubo) => {
        mongoose.connect(...)
        const User = require("./models/User.js)
        UboMongoose.registerCommonModel(ubo, User);

        return async() -> {
            // other cleanup
            await mongoose.close()
        }
    }

Creates CLI

   ubo User.get ID
   ubo User.create ...
   ubo User.

and webUI that can list, create all those.


Custom actions
    async function sync_user(name: string, params: string[]) {

    }
    ubo.registerAction("sync_user", sync_user, ["string", "...string[]"])

will create action that expects one string param and rest of params will be
merged into list of string.

Ubo will wrap your functions into transactions and proper logging, so even in WEB UI you're can User
plain-old console.log for basic feedback from long and/or not-so-well-integrated-with UI operations.

# Architecture

* `ubo` core module, import it in scripts
* `ubo-web` - webapp
* `ubo-cli` - CLI

  Use npx `ubo-cli Action ... ` will load your local model
* `ubo-interface` - typescript only defs


# Plan
## Name

Alternative names autoadmin, uberadmin.

# `@ubo/webapp`

> TODO: description

## Usage

```
const webapp = require('@ubo/webapp');

// TODO: DEMONSTRATE API
```

## Authentication idea.

Giving that this tool is expected to access possibly even production data, we need strong auth.
It is expected, that app will be deployed directly to kind-a main/aux server in aux env and thus
 - requires strong "own" security
 - requires TLS by default i guess

```
const uboWeb = require("@ubo/webapp");

module.exports = acync (ubo => {
    uboWeb.configure(ubo, [
        "builtinUsers": [
            { email: ""me@mydomain.com", role: "admin" }
        ],
        "auth": {
            "type": "token-via-email",

            "smtp": {
                ...
            }
        }
    ])
}
```

## API

# API

## Actions

Syntax:

    GET /api/actions - list of available actions
        list of actions, , by default sorted by [action.sortOrder, action.name]
        standard search options apply

    POST /api/action/:name - execute action, thus creating a `Task`

    GET /api/action/:name/task/:id - current task status, result and logs from invocation

        persistent only if APP provides proper audit-log API

    GET /api/action/:name/history - history of invocations

        TODO: your app should have provide log-like API that queries/writes to store
        shared amongst all instances of `ubo`

## Models

Syntax:

    GET /api/models  - list of available models / collections
         list of models, standard search options apply, by default sorted by [model.sortOrder, model.name]

    GET /api/data/:name

    GET /api/data/:name/:id

    POST /api/data/:name/:id/:methodName

        - call particular exposed method on obejct instance, rest of API is like action
        - creates a `Task` instance

    GET /api/data/:name/:id/history
        - only if history API is installed

## Tasks

Task is an actually executed or planned instance of action and/or model method call.

Model:

    * `id` - used to identify also in webap
    * `action` - `$action:name` or `$model:Model:key:action`

Syntax:
    GET /api/tasks/
         list of tasks, standard search options apply, by default sorted by most recent ones

    GET /api/task/:id - current task status, result and logs from invocation

    GET /api/task/:id/log

    websocket uboTaskGetLog:id -> stream

    HMM, research streaming/rxjs APIs for web

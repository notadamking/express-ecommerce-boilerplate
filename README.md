# Rest API Documentation

## Table of Contents

1. [Users](#users)
2. [Firms](#firms)

---

## Users:

**Title:** Get a user

**Endpoint:** GET /users/:id

**URL Params:**

*Required*

id: String

**Responses**

*Success (200 OK)*

```js
{
  id: String,
  email: String,
  name: {
    salutation: String,
    first: String,
    middle: String,
    last: String,
    suffix: String,
  },
  fullName: String,
  stateBars: [
    {
      id: Number,
      state: String,
      admitDate: Date,
      years: Number,
    }
  ],
  department: String,
  position: String,
  firm: Firm, (see firm)
  phones: [
    {
      type: String,
      number: String,
      ext: String,
    },
  ],
}
```

*Not Found (404 )*

```js
{ error: `No user exists with id ${id}` }
```

*Error (500 Internal Error)*

```js
{ error: 'Oops! Something went wrong on our end!' }
```
---

**Title:** Create new user

**Endpoint:** POST /users/

**Data Payload:**

*Required*

```js
{
  email: String,
  password: String,
  firstName: String,
  lastName: String,
  phoneNumber: String
}
```

**Responses**

*Success (200 OK)*

```js
{
  id: String,
  email: String,
  name: {
    salutation: String,
    first: String,
    middle: String,
    last: String,
    suffix: String,
  },
  fullName: String,
  stateBars: [
    {
      id: Number,
      state: String,
      admitDate: Date,
      years: Number,
    }
  ],
  department: String,
  position: String,
  firm: Firm, (see firm)
  phones: [
    {
      type: String,
      number: String,
      ext: String,
    },
  ],
}
```

*Error (409 Conflict)*

```js
{ error: 'User already exists' })
```

*Error (400 Bad Request)*

```js
{ error: 'Email, password, firstName, lastName, and phoneNumber are required to create a new user.' }
```

*Error (500 Internal Error)*

```js
{ error: 'Oops! Something went wrong on our end!' }
```

---


**Title:** Update a user

**Endpoint:** PUT /users/:id

**URL Params**

*Required*
id: String
**Data Payload:**

*Optional*

```js
{
  email: String,
  name: {
    salutation: String,
    first: String,
    middle: String,
    last: String,
    suffix: String,
  },
  stateBars: [
    {
      id: Number,
      state: String,
      admitDate: Date,
    }
  ],
  department: String,
  position: String,
  firm: Firm, (see firm)
  phones: [
    {
      type: String,
      number: String,
      ext: String,
    },
  ],
}
```

**Responses**

*Success (200 OK)*

```js
{
  id: String,
  email: String,
  name: {
    salutation: String,
    first: String,
    middle: String,
    last: String,
    suffix: String,
  },
  fullName: String,
  stateBars: [
    {
      id: Number,
      state: String,
      admitDate: Date,
      years: Number,
    }
  ],
  department: String,
  position: String,
  firm: Firm, (see firm)
  phones: [
    {
      type: String,
      number: String,
      ext: String,
    },
  ],
}
```

*Error (403 Forbidden)*

```js
{ error: 'You do not have permission to update that user.' }
```

*Error (500 Internal Error)*

```js
{ error: 'Oops! Something went wrong on our end!' }
```


---


**Title:** Remove a user

**Endpoint:** DELETE /users/:id

**URL Params**

*Required*
id: String

**Responses**

*Success (200 OK)*

```js
{ info: 'Successfully removed user.' }
```

*Error (403 Forbidden)*

```js
{ error: 'You do not have permission to remove that user.' }
```

*Error (500 Internal Error)*

```js
{ error: 'Oops! Something went wrong on our end!' }
```

---

## Firms

**Title:** Get a firm

**Endpoint:** GET /firms/:id

**URL Params:**

*Required*

id: String

**Responses**

*Success (200 OK)*

```js
{
  id: String,
  name: String,
  employerId: String,
  status: String,
  address: {
    lines: [String],
    city: String,
    state: String,
    zip: String,
    country: String,
  },
}
```

*Error (404 Not Found)*

```js
{ error: `No firm exists with id ${id}` }
```

*Error (500 Internal Error)*

```js
{ error: 'Oops! Something went wrong on our end!' }
```
---

**Title:** Create new firm

**Endpoint:** POST /firms/

**Data Payload:**

*Required*

```js
{
  name: String,
}
```

*Optional*

```js
{
  employerId: String,
  status: String,
  address: {
    lines: [String],
    city: String,
    state: String,
    zip: String,
    country: String,
  },
}
```

**Responses**

*Success (200 OK)*

```js
{
  id: String,
  name: String,
  employerId: String,
  status: String,
  address: {
    lines: [String],
    city: String,
    state: String,
    zip: String,
    country: String,
  },
}
```

*Error (409 Conflict)*

```js
{ error: 'Firm already exists' })
```

*Error (400 Bad Request)*

```js
{ error: 'Name is required to create a new firm.' }
```

*Error (500 Internal Error)*

```js
{ error: 'Oops! Something went wrong on our end!' }
```

---


**Title:** Update a firm

**Endpoint:** PUT /firms/:id

**URL Params**

*Required*
id: String

**Data Payload:**

*Optional*

```js
{
  name: String,
  employerId: String,
  status: String,
  address: {
    lines: [String],
    city: String,
    state: String,
    zip: String,
    country: String,
  },
}
```

**Responses**

*Success (200 OK)*

```js
{
  id: String,
  name: String,
  employerId: String,
  status: String,
  address: {
    lines: [String],
    city: String,
    state: String,
    zip: String,
    country: String,
  },
}
```

*Error (403 Forbidden)*

```js
{ error: 'You do not have permission to update that user.' }
```

*Error (500 Internal Error)*

```js
{ error: 'Oops! Something went wrong on our end!' }
```


---


**Title:** Remove a firm

**Endpoint:** DELETE /firms/:id

**URL Params**

*Required*
id: String

**Responses**

*Success (200 OK)*

```js
{ info: 'Successfully removed firm.' }
```

*Error (403 Forbidden)*

```js
{ error: 'You do not have permission to remove that firm.' }
```

*Error (500 Internal Error)*

```js
{ error: 'Oops! Something went wrong on our end!' }
```

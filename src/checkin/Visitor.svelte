<script>
  export let name = '';
  export let phone_number = '';
  export let email = '';
  export let errors = {};
  export let disabled = false;

  function onChange(e) {
    errors[e.target.id] = false;
  }
</script>

<div class="visitor">
  <form on:submit|preventDefault>
    <div class="input-row" class:invalid={errors.name}>
      <label for="name">Name:</label>
      <input type="text" id="name" bind:value={name} {disabled} on:change={onChange}>
      <div class="error">{errors.name}</div>
    </div>
    <div class="input-row" class:invalid={errors.phone_number}>
      <label for="phone_number">Tel:</label>
      <input type="text" id="phone_number" bind:value={phone_number} {disabled} on:change={onChange}>
      <div class="error">{errors.phone_number}</div>
    </div>
    <div class="input-row"  class:invalid={errors.email}>
      <label for="email">Email:</label>
      <input type="email" id="email" bind:value={email} {disabled} on:change={onChange}>
      <div class="error">{errors.email}</div>
    </div>
  </form>
</div>

<style>
  .visitor {
    margin: 0.2em;
    padding: 0.2em;
    border: 1px solid grey;
    border-radius: 0.2em;
  }

  .input-row {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.2em;
  }

  .input-row:last-child {
    padding-bottom: 0;
  }

  label, input {
    display: block;
  }

  input {
    min-width: 75%;
    font-size: 1.1em;
  }

  .error {
    display: none;
    font-size: 0.8em;
    text-align: right;
    color: red;
  }

  .invalid .error {
    display: block;
    width: 100%;
  }

  .invalid input {
    border: 1px solid red;
  }
</style>
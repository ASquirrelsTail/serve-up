<script>
  import Visitor from './Visitor.svelte';
  import { post } from '../fetch.js';
  import { group } from '../store.js';

  let visitors = [];
  let errors = [];
  addVisitor();

  let error = '';
  let errorMessage;

  let disabled = false;

  function addVisitor() {
    visitors = [...visitors, {name:'', phone_number: '', email: ''}]
    errors = [...errors, {}];
  }

  function checkIn() {
    disabled = true;
    visitors = [visitors[0], ...visitors.slice(1).filter(visitor => visitor.name || visitor.email || visitor.phone_number)];
    post('group/', {visitors})
      .then(async response => {
        if (response.status === 204) $group = true;
        else {
          const data = await response.json();
          error = data.error;
          errors = data.form_errors;
          errorMessage.scrollIntoView();
          disabled = false;
        }
    });
  }
</script>

<h1>Check In</h1>
<p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Libero earum praesentium tempora fuga ipsam dolor sunt recusandae dicta possimus, animi dolore fugit labore nesciunt veniam vel officia, laboriosam deserunt molestiae!</p>
<p class="error" class:visible={error} bind:this={errorMessage}>{error}</p>
{#each visitors as visitor, i (i)}
  <Visitor bind:name={visitor.name}
    bind:email={visitor.email}
    bind:phone_number={visitor.phone_number}
    errors={errors[i]}
    {disabled}/>
{/each}
<div class="buttons">
  <button on:click|preventDefault={addVisitor} {disabled}>Add another visitor</button>
  <button on:click|preventDefault={checkIn} {disabled}>Check In</button>
</div>

<style>
  .buttons {
    display: flex;
    justify-content: center;
  }

  .buttons button {
    min-width: 30%
  }

  .buttons button:first-child {
    margin-right: 1em;
  }

  .error {
    display: none;
    font-size: 0.8em;
    color: red;
  }

  .error.visible {
    display: block;
  }
</style>
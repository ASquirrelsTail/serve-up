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
<p>Please enter the group's names and contact details for at least one person who can provide details for the others. The information you provide will not be shared with anyone except for NHS Track and Trace and will be deleted after 21 days.</p>
<p>If you would prefer to leave your details in written form please speak to a member of staff.</p>
<p class="error" class:visible={error} bind:this={errorMessage}>{error}</p>
{#each visitors as visitor, i (i)}
  <Visitor bind:name={visitor.name}
    bind:email={visitor.email}
    bind:phone_number={visitor.phone_number}
    errors={errors[i]}
    {disabled}/>
{/each}
<div class="buttons">
  <button class="primary md" on:click|preventDefault={addVisitor} {disabled}>Add another visitor</button>
  <button class="primary md" on:click|preventDefault={checkIn} {disabled}>Check In</button>
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
  }

  .error.visible {
    display: block;
  }
</style>
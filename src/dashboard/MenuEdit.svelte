<script>
  import Review from '../Review.svelte';
  import MenuSectionUpdate from './MenuSectionUpdate.svelte';
  import MenuItemUpdate from './MenuItemUpdate.svelte';
  import DashboardMenuItem from './DashboardMenuItem.svelte';
  import { post } from '../fetch.js';

  let review = false;
  let reviewData = {};
  
  let menuItems = fetch('/menu/')
                    .then(response => response.json())
                    .then(data => {
                      console.log(data.sections)
                      return data.sections});

  function openSectionUpdate(section={}) {
    review = MenuSectionUpdate;
    reviewData = {section: section};
  }

  function openItemUpdate(item, section) {
    review = MenuItemUpdate;
    reviewData = {item, section};
  }

  function delItemOrSection(e) {
    if (e.detail.section) menuItems = menuItems.then(sections => {
      review = false;
      return [...sections.filter(section => section.id !== e.detail.section.id)];
    });
    else if (e.detail.item) menuItems = menuItems.then(sections => {
      review = false;
      const parentSection = sections.find(section => section.id === e.detail.item.sectionId);
      parentSection.items = [...parentSection.items.filter(item => item.id !== e.detail.item.id)];
      return [...sections];
    });
  }

  function updateItemOrSection(e) {
    console.log(e.detail)
    if (e.detail.section) menuItems = menuItems.then(sections => {
      review = false;
      const index = sections.findIndex(section => section.id === e.detail.section.id);
      if (index < 0) return [...sections, e.detail.section];
      else sections[index] = e.detail.section;
      return [...sections];
    });
    else if (e.detail.item) menuItems = menuItems.then(sections => {
      review = false;
      const parentSection = sections.find(section => section.id === e.detail.item.sectionId);
      const index = parentSection.items.findIndex(item => item.id === e.detail.item.id);
      if (index < 0) parentSection.items = [...parentSection.items, e.detail.item];
      else parentSection.items[index] = e.detail.item;
      return [...sections];
    });
  }

  function moveUp(curSection) {
    post('/menu/sections/' + curSection.id + '/', {'up': true}).then(response => {
      if (response.status === 204) menuItems = menuItems.then(sections => {
        const index = sections.findIndex(section => section.id === curSection.id);
        if (index > 0) {
          const oldOrder = curSection.order;
          curSection.order = sections[index - 1].order;
          sections[index - 1]. order = oldOrder;
          sections[index] = sections[index - 1];
          sections[index - 1] = curSection;
        }
        return [...sections]
      });
    });
  }

  function moveDown(curSection) {
    post('/menu/sections/' + curSection.id + '/', {'down': true}).then(response => {
      if (response.status === 204) menuItems = menuItems.then(sections => {
        const index = sections.findIndex(section => section.id === curSection.id);
        if (index < sections.length - 1) {
          const oldOrder = curSection.order;
          curSection.order = sections[index + 1].order;
          sections[index + 1]. order = oldOrder;
          sections[index] = sections[index + 1];
          sections[index + 1] = curSection;
        }
        return [...sections]
      });
    });
  }

  function moveItemUp(curSection, curItem) {
    post('/menu/items/' + curItem.id + '/', {'up': true}).then(response => {
      if (response.status === 204) menuItems = menuItems.then(sections => {
        const parentSection = sections.find(section => section.id === curSection.id);
        const index = parentSection.items.findIndex(item => item.id === curItem.id);
        if (index > 0) {
          const oldOrder = curItem.order;
          curItem.order = parentSection.items[index - 1].order;
          parentSection.items[index - 1]. order = oldOrder;
          parentSection.items[index] = parentSection.items[index - 1];
          parentSection.items[index - 1] = curItem;
        }
        return [...sections]
      });
    });
  }

  function moveItemDown(curSection, curItem) {
    post('/menu/items/' + curItem.id + '/', {'down': true}).then(response => {
      if (response.status === 204) menuItems = menuItems.then(sections => {
        const parentSection = sections.find(section => section.id === curSection.id);
        const index = parentSection.items.findIndex(item => item.id === curItem.id);
        if (index < parentSection.items.length - 1) {
          const oldOrder = curItem.order;
          curItem.order = parentSection.items[index + 1].order;
          parentSection.items[index + 1]. order = oldOrder;
          parentSection.items[index] = parentSection.items[index + 1];
          parentSection.items[index + 1] = curItem;
        }
        return [...sections]
      });
    });
  }

</script>

<h2>Menu</h2>
<div>
  {#await menuItems then sections}
    {#each sections as section, i (section.id)}
      <div class="section" class:hidden={!section.visible}>
        <div class="section-inner">
          <div class="details">
            <h3>{section.name}</h3>
            <p class="description">{section.description}</p>
          </div>
          <div>
            <button class="primary md" on:click="{() => openSectionUpdate(section)}">Edit</button>
          </div>
          <div class="up-down">
            <button class="primary" on:click="{() => moveUp(section)}" disabled="{i === 0}">+</button> 
            <button class="primary" on:click="{() => moveDown(section)}" disabled="{i === sections.length - 1}">-</button>
          </div>
        </div>
        <div>
          {#each section.items as item, j (item.id)}
          <DashboardMenuItem {item} last="{j === section.items.length - 1}" first="{j === 0}"
            on:edititem="{(e) => openItemUpdate(e.detail, section)}"
            on:moveup="{() => moveItemUp(section, item)}"
            on:movedown="{() => moveItemDown(section, item)}"/>
          {/each}
        </div>
        <div class="add-new">
          <button class="primary md"  on:click="{() => openItemUpdate({}, section)}">Add New Item</button>
        </div>
      </div>
    {/each}
  {/await}
</div>

<div class="add-new">
  <button class="primary md" on:click="{() => openSectionUpdate()}">Add New Menu Section</button>
</div>

<Review bind:review={review}>
  <svelte:component this={review} {...reviewData} on:delete={delItemOrSection} on:update={updateItemOrSection}/>
  <div class="back">
    <button class="primary md" on:click="{() => review=false}">Back to menu</button>
  </div>
</Review>

<style>
  .section-inner {
    display: flex;
    align-items: center;
  }

  .details {
    flex-grow: 1;
    padding: 0 0.2em;
  }

  .add-new {
    text-align: center;
    margin: 0.5em;
  }

  .back {
    text-align: center;
  }

  .up-down button {
    display: block;
    width: 1em;
    height: 1em;
    margin: 0.2em;
    margin-left: 0.4em;
    margin-right: 0.4em;
    padding: 0;
  }
</style>
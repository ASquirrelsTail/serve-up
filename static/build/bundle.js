var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value = ret) {
        store.set(value);
        return ret;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/checkin/Visitor.svelte generated by Svelte v3.23.2 */

    const file = "src/checkin/Visitor.svelte";

    function create_fragment(ctx) {
    	let div6;
    	let form;
    	let div1;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let div0;
    	let t3_value = /*errors*/ ctx[3].name + "";
    	let t3;
    	let t4;
    	let div3;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let div2;
    	let t8_value = /*errors*/ ctx[3].phone_number + "";
    	let t8;
    	let t9;
    	let div5;
    	let label2;
    	let t11;
    	let input2;
    	let t12;
    	let div4;
    	let t13_value = /*errors*/ ctx[3].email + "";
    	let t13;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			form = element("form");
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Name:";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div0 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			label1 = element("label");
    			label1.textContent = "Tel:";
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			div2 = element("div");
    			t8 = text(t8_value);
    			t9 = space();
    			div5 = element("div");
    			label2 = element("label");
    			label2.textContent = "Email:";
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div4 = element("div");
    			t13 = text(t13_value);
    			attr_dev(label0, "for", "name");
    			attr_dev(label0, "class", "svelte-1ftsr2y");
    			add_location(label0, file, 15, 6, 339);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "name");
    			input0.disabled = /*disabled*/ ctx[4];
    			attr_dev(input0, "class", "svelte-1ftsr2y");
    			add_location(input0, file, 16, 6, 377);
    			attr_dev(div0, "class", "error svelte-1ftsr2y");
    			add_location(div0, file, 17, 6, 463);
    			attr_dev(div1, "class", "input-row svelte-1ftsr2y");
    			toggle_class(div1, "invalid", /*errors*/ ctx[3].name);
    			add_location(div1, file, 14, 4, 281);
    			attr_dev(label1, "for", "phone_number");
    			attr_dev(label1, "class", "svelte-1ftsr2y");
    			add_location(label1, file, 20, 6, 583);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "phone_number");
    			input1.disabled = /*disabled*/ ctx[4];
    			attr_dev(input1, "class", "svelte-1ftsr2y");
    			add_location(input1, file, 21, 6, 628);
    			attr_dev(div2, "class", "error svelte-1ftsr2y");
    			add_location(div2, file, 22, 6, 730);
    			attr_dev(div3, "class", "input-row svelte-1ftsr2y");
    			toggle_class(div3, "invalid", /*errors*/ ctx[3].phone_number);
    			add_location(div3, file, 19, 4, 517);
    			attr_dev(label2, "for", "email");
    			attr_dev(label2, "class", "svelte-1ftsr2y");
    			add_location(label2, file, 25, 6, 852);
    			attr_dev(input2, "type", "email");
    			attr_dev(input2, "id", "email");
    			input2.disabled = /*disabled*/ ctx[4];
    			attr_dev(input2, "class", "svelte-1ftsr2y");
    			add_location(input2, file, 26, 6, 892);
    			attr_dev(div4, "class", "error svelte-1ftsr2y");
    			add_location(div4, file, 27, 6, 981);
    			attr_dev(div5, "class", "input-row svelte-1ftsr2y");
    			toggle_class(div5, "invalid", /*errors*/ ctx[3].email);
    			add_location(div5, file, 24, 4, 792);
    			add_location(form, file, 13, 2, 245);
    			attr_dev(div6, "class", "visitor svelte-1ftsr2y");
    			add_location(div6, file, 12, 0, 221);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, form);
    			append_dev(form, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t1);
    			append_dev(div1, input0);
    			set_input_value(input0, /*name*/ ctx[0]);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div0, t3);
    			append_dev(form, t4);
    			append_dev(form, div3);
    			append_dev(div3, label1);
    			append_dev(div3, t6);
    			append_dev(div3, input1);
    			set_input_value(input1, /*phone_number*/ ctx[1]);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, t8);
    			append_dev(form, t9);
    			append_dev(form, div5);
    			append_dev(div5, label2);
    			append_dev(div5, t11);
    			append_dev(div5, input2);
    			set_input_value(input2, /*email*/ ctx[2]);
    			append_dev(div5, t12);
    			append_dev(div5, div4);
    			append_dev(div4, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen_dev(input0, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[8]),
    					listen_dev(input1, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[9]),
    					listen_dev(input2, "change", /*onChange*/ ctx[5], false, false, false),
    					listen_dev(form, "submit", prevent_default(/*submit_handler*/ ctx[6]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input0, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*name*/ 1 && input0.value !== /*name*/ ctx[0]) {
    				set_input_value(input0, /*name*/ ctx[0]);
    			}

    			if (dirty & /*errors*/ 8 && t3_value !== (t3_value = /*errors*/ ctx[3].name + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div1, "invalid", /*errors*/ ctx[3].name);
    			}

    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input1, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*phone_number*/ 2 && input1.value !== /*phone_number*/ ctx[1]) {
    				set_input_value(input1, /*phone_number*/ ctx[1]);
    			}

    			if (dirty & /*errors*/ 8 && t8_value !== (t8_value = /*errors*/ ctx[3].phone_number + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div3, "invalid", /*errors*/ ctx[3].phone_number);
    			}

    			if (dirty & /*disabled*/ 16) {
    				prop_dev(input2, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (dirty & /*email*/ 4 && input2.value !== /*email*/ ctx[2]) {
    				set_input_value(input2, /*email*/ ctx[2]);
    			}

    			if (dirty & /*errors*/ 8 && t13_value !== (t13_value = /*errors*/ ctx[3].email + "")) set_data_dev(t13, t13_value);

    			if (dirty & /*errors*/ 8) {
    				toggle_class(div5, "invalid", /*errors*/ ctx[3].email);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name = "" } = $$props;
    	let { phone_number = "" } = $$props;
    	let { email = "" } = $$props;
    	let { errors = {} } = $$props;
    	let { disabled = false } = $$props;

    	function onChange(e) {
    		$$invalidate(3, errors[e.target.id] = false, errors);
    	}

    	const writable_props = ["name", "phone_number", "email", "errors", "disabled"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Visitor> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Visitor", $$slots, []);

    	function submit_handler(event) {
    		bubble($$self, event);
    	}

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	function input1_input_handler() {
    		phone_number = this.value;
    		$$invalidate(1, phone_number);
    	}

    	function input2_input_handler() {
    		email = this.value;
    		$$invalidate(2, email);
    	}

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("phone_number" in $$props) $$invalidate(1, phone_number = $$props.phone_number);
    		if ("email" in $$props) $$invalidate(2, email = $$props.email);
    		if ("errors" in $$props) $$invalidate(3, errors = $$props.errors);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		phone_number,
    		email,
    		errors,
    		disabled,
    		onChange
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("phone_number" in $$props) $$invalidate(1, phone_number = $$props.phone_number);
    		if ("email" in $$props) $$invalidate(2, email = $$props.email);
    		if ("errors" in $$props) $$invalidate(3, errors = $$props.errors);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		phone_number,
    		email,
    		errors,
    		disabled,
    		onChange,
    		submit_handler,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class Visitor extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			name: 0,
    			phone_number: 1,
    			email: 2,
    			errors: 3,
    			disabled: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Visitor",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get name() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get phone_number() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set phone_number(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get email() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set email(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get errors() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set errors(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Visitor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Visitor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const group = writable(document.body.dataset.group);
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    /* src/checkin/CheckIn.svelte generated by Svelte v3.23.2 */
    const file$1 = "src/checkin/CheckIn.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	child_ctx[13] = list;
    	child_ctx[14] = i;
    	return child_ctx;
    }

    // (46:0) {#each visitors as visitor, i (i)}
    function create_each_block(key_1, ctx) {
    	let first;
    	let visitor;
    	let updating_name;
    	let updating_email;
    	let updating_phone_number;
    	let current;

    	function visitor_name_binding(value) {
    		/*visitor_name_binding*/ ctx[8].call(null, value, /*visitor*/ ctx[12]);
    	}

    	function visitor_email_binding(value) {
    		/*visitor_email_binding*/ ctx[9].call(null, value, /*visitor*/ ctx[12]);
    	}

    	function visitor_phone_number_binding(value) {
    		/*visitor_phone_number_binding*/ ctx[10].call(null, value, /*visitor*/ ctx[12]);
    	}

    	let visitor_props = {
    		errors: /*errors*/ ctx[1][/*i*/ ctx[14]],
    		disabled: /*disabled*/ ctx[4]
    	};

    	if (/*visitor*/ ctx[12].name !== void 0) {
    		visitor_props.name = /*visitor*/ ctx[12].name;
    	}

    	if (/*visitor*/ ctx[12].email !== void 0) {
    		visitor_props.email = /*visitor*/ ctx[12].email;
    	}

    	if (/*visitor*/ ctx[12].phone_number !== void 0) {
    		visitor_props.phone_number = /*visitor*/ ctx[12].phone_number;
    	}

    	visitor = new Visitor({ props: visitor_props, $$inline: true });
    	binding_callbacks.push(() => bind(visitor, "name", visitor_name_binding));
    	binding_callbacks.push(() => bind(visitor, "email", visitor_email_binding));
    	binding_callbacks.push(() => bind(visitor, "phone_number", visitor_phone_number_binding));

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(visitor.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(visitor, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const visitor_changes = {};
    			if (dirty & /*errors, visitors*/ 3) visitor_changes.errors = /*errors*/ ctx[1][/*i*/ ctx[14]];
    			if (dirty & /*disabled*/ 16) visitor_changes.disabled = /*disabled*/ ctx[4];

    			if (!updating_name && dirty & /*visitors*/ 1) {
    				updating_name = true;
    				visitor_changes.name = /*visitor*/ ctx[12].name;
    				add_flush_callback(() => updating_name = false);
    			}

    			if (!updating_email && dirty & /*visitors*/ 1) {
    				updating_email = true;
    				visitor_changes.email = /*visitor*/ ctx[12].email;
    				add_flush_callback(() => updating_email = false);
    			}

    			if (!updating_phone_number && dirty & /*visitors*/ 1) {
    				updating_phone_number = true;
    				visitor_changes.phone_number = /*visitor*/ ctx[12].phone_number;
    				add_flush_callback(() => updating_phone_number = false);
    			}

    			visitor.$set(visitor_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(visitor.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(visitor.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(visitor, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(46:0) {#each visitors as visitor, i (i)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;
    	let t4;
    	let t5;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t6;
    	let div;
    	let button0;
    	let t7;
    	let t8;
    	let button1;
    	let t9;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*visitors*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*i*/ ctx[14];
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Check In";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Libero earum praesentium tempora fuga ipsam dolor sunt recusandae dicta possimus, animi dolore fugit labore nesciunt veniam vel officia, laboriosam deserunt molestiae!";
    			t3 = space();
    			p1 = element("p");
    			t4 = text(/*error*/ ctx[2]);
    			t5 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			div = element("div");
    			button0 = element("button");
    			t7 = text("Add another visitor");
    			t8 = space();
    			button1 = element("button");
    			t9 = text("Check In");
    			add_location(h1, file$1, 42, 0, 1129);
    			add_location(p0, file$1, 43, 0, 1147);
    			attr_dev(p1, "class", "error svelte-1arn6tv");
    			toggle_class(p1, "visible", /*error*/ ctx[2]);
    			add_location(p1, file$1, 44, 0, 1380);
    			button0.disabled = /*disabled*/ ctx[4];
    			attr_dev(button0, "class", "svelte-1arn6tv");
    			add_location(button0, file$1, 53, 2, 1675);
    			button1.disabled = /*disabled*/ ctx[4];
    			attr_dev(button1, "class", "svelte-1arn6tv");
    			add_location(button1, file$1, 54, 2, 1762);
    			attr_dev(div, "class", "buttons svelte-1arn6tv");
    			add_location(div, file$1, 52, 0, 1651);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t4);
    			/*p1_binding*/ ctx[7](p1);
    			insert_dev(target, t5, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t6, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(button0, t7);
    			append_dev(div, t8);
    			append_dev(div, button1);
    			append_dev(button1, t9);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", prevent_default(/*addVisitor*/ ctx[5]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*checkIn*/ ctx[6]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*error*/ 4) set_data_dev(t4, /*error*/ ctx[2]);

    			if (dirty & /*error*/ 4) {
    				toggle_class(p1, "visible", /*error*/ ctx[2]);
    			}

    			if (dirty & /*errors, visitors, disabled*/ 19) {
    				const each_value = /*visitors*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t6.parentNode, outro_and_destroy_block, create_each_block, t6, get_each_context);
    				check_outros();
    			}

    			if (!current || dirty & /*disabled*/ 16) {
    				prop_dev(button0, "disabled", /*disabled*/ ctx[4]);
    			}

    			if (!current || dirty & /*disabled*/ 16) {
    				prop_dev(button1, "disabled", /*disabled*/ ctx[4]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p1);
    			/*p1_binding*/ ctx[7](null);
    			if (detaching) detach_dev(t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $group;
    	validate_store(group, "group");
    	component_subscribe($$self, group, $$value => $$invalidate(11, $group = $$value));
    	let visitors = [];
    	let errors = [];
    	addVisitor();
    	let error = "";
    	let errorMessage;
    	let disabled = false;

    	function addVisitor() {
    		$$invalidate(0, visitors = [...visitors, { name: "", phone_number: "", email: "" }]);
    		$$invalidate(1, errors = [...errors, {}]);
    	}

    	function checkIn() {
    		$$invalidate(4, disabled = true);

    		$$invalidate(0, visitors = [
    			visitors[0],
    			...visitors.slice(1).filter(visitor => visitor.name || visitor.email || visitor.phone_number)
    		]);

    		fetch("group/", {
    			method: "POST",
    			credentials: "same-origin",
    			headers: {
    				"Content-Type": "application/json",
    				"X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
    			},
    			body: JSON.stringify({ visitors }), // body data type must match "Content-Type" header
    			
    		}).then(async response => {
    			if (response.status === 204) set_store_value(group, $group = true); else {
    				const data = await response.json();
    				$$invalidate(2, error = data.error);
    				$$invalidate(1, errors = data.form_errors);
    				errorMessage.scrollIntoView();
    				$$invalidate(4, disabled = false);
    			}
    		});
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CheckIn> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("CheckIn", $$slots, []);

    	function p1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			errorMessage = $$value;
    			$$invalidate(3, errorMessage);
    		});
    	}

    	function visitor_name_binding(value, visitor) {
    		visitor.name = value;
    		$$invalidate(0, visitors);
    	}

    	function visitor_email_binding(value, visitor) {
    		visitor.email = value;
    		$$invalidate(0, visitors);
    	}

    	function visitor_phone_number_binding(value, visitor) {
    		visitor.phone_number = value;
    		$$invalidate(0, visitors);
    	}

    	$$self.$capture_state = () => ({
    		Visitor,
    		group,
    		visitors,
    		errors,
    		error,
    		errorMessage,
    		disabled,
    		addVisitor,
    		checkIn,
    		$group
    	});

    	$$self.$inject_state = $$props => {
    		if ("visitors" in $$props) $$invalidate(0, visitors = $$props.visitors);
    		if ("errors" in $$props) $$invalidate(1, errors = $$props.errors);
    		if ("error" in $$props) $$invalidate(2, error = $$props.error);
    		if ("errorMessage" in $$props) $$invalidate(3, errorMessage = $$props.errorMessage);
    		if ("disabled" in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		visitors,
    		errors,
    		error,
    		errorMessage,
    		disabled,
    		addVisitor,
    		checkIn,
    		p1_binding,
    		visitor_name_binding,
    		visitor_email_binding,
    		visitor_phone_number_binding
    	];
    }

    class CheckIn extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CheckIn",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.2 */
    const file$2 = "src/App.svelte";

    // (7:0) {:else}
    function create_else_block(ctx) {
    	let signin;
    	let current;
    	signin = new CheckIn({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(signin.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(signin, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(signin.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(signin.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(signin, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(7:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (5:0) {#if $group}
    function create_if_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "We have a group.";
    			add_location(p, file$2, 5, 0, 119);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(5:0) {#if $group}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$group*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $group;
    	validate_store(group, "group");
    	component_subscribe($$self, group, $$value => $$invalidate(0, $group = $$value));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	$$self.$capture_state = () => ({ SignIn: CheckIn, group, $group });
    	return [$group];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

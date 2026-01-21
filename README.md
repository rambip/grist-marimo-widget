<img width="100" height="100" alt="image" align="left" src="https://github.com/user-attachments/assets/aa0d6d54-e54d-4c6d-803b-5f8667baa98e" />

===============================

**Made with 💙 at [OpenSourcePolitics](https://opensourcepolitics.eu/)**

===============================

# Marimo inside Grist

This project aims to provide a [Marimo](https://marimo.io) notebook inside Grist, as a widget.

<img width="865" height="738" alt="image" src="https://github.com/user-attachments/assets/4ae133f3-7eea-4b8a-905b-f5e980867951" />


# How to use

Click "add widget to page" inside Grist, and select this widget from the URL:
```
https://rambip.github.io/grist-marimo-widget
```


Once the notebook is loaded, you can use it like any other marimo notebook.

<details>
<summary>
⚠️ There are some caveats when you use a notebook inside Grist. 
</summary>
The most important thing to understand: the entire notebook runs **in your browser** (python is translated to instructions your browser understands, thank's to [pyodide](https://pyodide.org/en/stable/)). This means that:
- The performance is limited. The memory is limted to 2G, and it will be slower than a classic notebook.
- Libraries are missing. A lot of libraries have made an effort to be packaged for browsers, but not all of them. See [here](https://docs.marimo.io/guides/wasm/#supported-packages) for more information
- Some requests might be blocked. Since the notebook runs inside Grist, your notebook has limits regarding what sites he can communicate with. This is a security limitation, preventing that Grist widgets use information about the tables and send them to external sites. This is what CORS is about, you can read more [here](https://ieftimov.com/posts/deep-dive-cors-history-how-it-works-best-practices/). But don't panic: a lot of public APIs will work seemlessly.
- there are a few more technical limitations, you can read them on [marimo's website](https://docs.marimo.io/guides/wasm/#limitations)
</details>


## Reading from Grist

Inside python, the grist data is available as a json file inside `data.json`, in the current directory.

You can read it as a dataframe, for example with `pandas.read_csv("data.json")`

The file will update each time you change a value in the table

<details>
<summary>
    Autorun
</summary>
Marimo has a wonderful feature: autorun.
If some cell A is updated, and another cell B depends on the result of A to do a comuptation, then B will be updated.
In order to provide the same experience with the Grist data, Grist will force the setup cell to re-run each time values in the table change. Since the setup cell executes `GRIST_DATA_PATH="data.json"`, this will force all the cells that use `GRIST_DATA_PATH` to rerun.
</details>

⚠️ To avoid problems, make sure that:
- you give the correct permissions to you widget (read table or full access)
- all the columns you want are set as "visible" in the widget settings. This means that if you create a column, it will not be available in python unless you set it as "visible" manually.

## Writing to Grist

TODO


# How it works

TODO

# Contributing

TODO

# ROADMAP

- [x] Reading grist table from marimo
- [x] Reloading cells automatically when grist values change
- [x] Applying actions to the grist document from marimo
- [x] Use the right color theme (light / dark)
- [ ] Add examples for using APIs and writing to the grist doc
- [ ] Add a warning when the user tries to use the notebook outside grist
- [ ] import data from multiple files

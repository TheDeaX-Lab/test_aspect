const fs = require("fs")
const pattern = /<(?<tag>[^\s]*)\s*(?<attrs>(?:[^\s<>]+="[^\s<>]+"\s*)*)(?:>(?<content>(?:(?!<\/\1>).)*?)<\/\1>|\/>)/g
const not_empty_pattern = /[^\s]/g

function xml_to_json(xml_string) {
    let xml_json = []
    let match
    for (; ;) {
        match = pattern.exec(xml_string)
        pattern.lastIndex = 0
        if (!match) {
            break
        }
        else if (match.index > 0 && not_empty_pattern.test(xml_string.slice(0, match.index))) {
            xml_json.push(xml_string.slice(0, match.index).trim())
            xml_string = xml_string.slice(match.index)
        }
        xml_string = xml_string.replace(match[0], "")
        let { tag, attrs, content } = match.groups
        let obj = {
            tag, attrs: attrs
                .split(" ")
                .map(r => r.split("="))
                .filter(([k, v]) => !!k && !!v)
                .map(([k, v]) => [k, v.slice(1, v.length - 1)])
                .reduce((acc, [k, v]) => {
                    acc[k] = v
                    return acc
                }, {})
        }
        if (!!content) obj.children = xml_to_json(content)
        xml_json.push(obj)
    }
    return xml_json
}

function search_from_1c_xml_entity_type(xml_obj, entity_type_name) {
    const searched = xml_obj.filter(r => r.tag === "EntityType" && r.attrs.Name === entity_type_name)
    if (searched.length > 0) {
        const founded = searched[0]
        const entity_type = founded.children.reduce((acc, r1) => {
            switch (r1.tag) {
                case "Property":
                    let required
                    let lst
                    if (r1.attrs.Nullable === "true") required = false
                    else if (r1.attrs.Nullable === "false") required = true
                    else required = null
                    if (r1.attrs.Name === "Ref_Key") lst = acc.keyProperties
                    else lst = acc.properties
                    lst.push({
                        name: r1.attrs.Name,
                        dataType: r1.attrs.Type,
                        required: required
                    })
                    break
                case "NavigationProperty":
                    const relation_ship_name = r1.attrs.Relationship.split(".")[1]
                    const searched_association = xml_obj
                        .filter(r2 => r2.tag === "Association" && r2.attrs.Name === relation_ship_name)
                    if (searched_association.length > 0) {
                        let founded_association = searched_association[0]
                        acc.properties.push({
                            name: r1.attrs.Name,
                            refName: founded_association.children[1].attrs.Type
                        })
                    } else {
                        throw new Error("Такой ассоциации не найдено")
                    }
                    break
            }
            return acc
        }, {
            name: founded.attrs.Name,
            type: founded.attrs.Name.split("_")[0],
            keyProperties: [],
            properties: []
        })
        return entity_type
    } else {
        throw new Error("Такой сущности не найдено")
    }
}

fs.readFile("./test_data.txt", (err, data) => {
    if (err) throw err
    let obj = xml_to_json(data.toString().replace(/\t|\r\n/g, " ").trim())
    let entity_type = search_from_1c_xml_entity_type(obj, "Catalog_Валюты")
    console.log(entity_type)
})

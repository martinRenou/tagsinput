#!/usr/bin/env python
# coding: utf-8

# Copyright (c) QuantStack.
# Distributed under the terms of the Modified BSD License.

"""TagsInput class.

Represents a list of tags.
"""

from traitlets import (
    CaselessStrEnum, Bool, Unicode, List, TraitError, validate
)

from ipywidgets import Color, ValueWidget

from ._frontend import module_name, module_version



class TagsInputBase(ValueWidget):
    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)

    value = List().tag(sync=True)
    allow_duplicates = Bool(True).tag(sync=True)

    @validate('value')
    def _validate_value(self, proposal):
        if ('' in proposal['value']):
            raise TraitError('The value of a TagsInput widget cannot contain blank strings')
        return proposal['value']


class TagsInput(TagsInputBase):
    """
    List of string tags
    """
    _model_name = Unicode('TagsInputModel').tag(sync=True)
    _view_name = Unicode('TagsInputView').tag(sync=True)

    value = List(Unicode(), help='List of string tags').tag(sync=True)
    tag_style = CaselessStrEnum(
        values=['primary', 'success', 'info', 'warning', 'danger', ''], default_value='',
        help="""Use a predefined styling for the tags.""").tag(sync=True)


class ColorsInput(TagsInputBase):
    """
    List of color tags
    """
    _model_name = Unicode('ColorsInputModel').tag(sync=True)
    _view_name = Unicode('ColorsInputView').tag(sync=True)

    value = List(Color(), help='List of string tags').tag(sync=True)
